import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

interface EmailConfig {
    host?: string;
    port?: number;
    secure?: boolean;
    requireTLS?: boolean;
    auth?: {
        user: string;
        pass: string;
    };
    service?: string;
    tls?: {
        rejectUnauthorized?: boolean;
    };
    logger?: boolean;
    debug?: boolean;
    connectionTimeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
}

// Integration email config interface (from database)
export interface IntegrationEmailConfig {
    smtp_host: string;
    smtp_port: number;
    smtp_user: string;
    smtp_password: string;
    smtp_secure?: boolean;
    from_email: string;
    from_name?: string;
}

// Create email transporter from integration config or environment variables
const createTransporter = (integrationConfig?: IntegrationEmailConfig) => {
    // If integration config is provided, use it (from database)
    if (integrationConfig) {
        if (!integrationConfig.smtp_host || !integrationConfig.smtp_user || !integrationConfig.smtp_password) {
            throw new Error('Invalid integration config: missing required SMTP fields');
        }

        // Validate SMTP host is not an email address
        if (integrationConfig.smtp_host.includes('@')) {
            throw new Error(`Invalid SMTP Host: "${integrationConfig.smtp_host}" is an email address. Use server address like "smtp.gmail.com"`);
        }

        const port = integrationConfig.smtp_port;

        let secure: boolean;
        let requireTLS: boolean | undefined;

        if (port === 465) {
            secure = true;
            requireTLS = undefined;
        } else if (port === 587) {
            secure = false;
            requireTLS = true;
        } else {
            secure = integrationConfig.smtp_secure ?? false;
            requireTLS = secure ? undefined : true;
        }

        const config: EmailConfig = {
            host: integrationConfig.smtp_host,
            port: port,
            secure: secure,
            ...(requireTLS !== undefined ? { requireTLS } : {}),
            auth: {
                user: integrationConfig.smtp_user,
                pass: integrationConfig.smtp_password,
            },
            connectionTimeout: 10000, // 10s
            greetingTimeout: 5000,    // 5s
            socketTimeout: 10000,
            logger: true,
            debug: true,
        };
        return nodemailer.createTransport(config);
    }

    const emailService = process.env.EMAIL_SERVICE;
    const emailHost = process.env.EMAIL_HOST;
    const emailPort = parseInt(process.env.EMAIL_PORT || '587', 10);
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;

    if (!emailUser || !emailPassword) {
        throw new Error('Email configuration is missing. Please set EMAIL_USER and EMAIL_PASSWORD in .env');
    }

    const config: EmailConfig = {
        auth: {
            user: emailUser,
            pass: emailPassword,
        },
        connectionTimeout: 10000, // 10s
        greetingTimeout: 5000,    // 5s
        socketTimeout: 10000,
        logger: true,
        debug: true,
    };

    // If service is specified, use it (simpler for Gmail, Outlook, etc.)
    if (emailService) {
        config.service = emailService;
    } else if (emailHost) {
        // Otherwise use custom SMTP
        config.host = emailHost;
        config.port = emailPort;
        config.secure = emailPort === 465; // true for 465, false for other ports
    } else {
        // Default to Gmail if nothing specified
        config.service = 'gmail';
    }

    return nodemailer.createTransport(config);
};

// Email options interface
export interface SendEmailOptions {
    from?: string;
    fromName?: string;
    integrationConfig?: IntegrationEmailConfig;
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    cc?: string | string[];
    bcc?: string | string[];
    attachments?: Array<{
        filename: string;
        path?: string;
        content?: string | Buffer;
        contentType?: string;
    }>;
}

// Send email function
export const sendEmail = async (options: SendEmailOptions): Promise<void> => {
    try {
        const transporter = createTransporter(options.integrationConfig);

        let fromEmail: string;
        let fromName: string;

        if (options.integrationConfig) {
            fromEmail = options.from || options.integrationConfig.from_email;
            fromName = options.fromName || options.integrationConfig.from_name || 'aNquest+';
        } else {
            // Fall back to provided values or environment variables
            fromEmail = options.from || process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@anquest.com';
            fromName = options.fromName || process.env.EMAIL_FROM_NAME || 'aNquest+';
        }

        const mailOptions = {
            from: `"${fromName}" <${fromEmail}>`,
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            subject: options.subject,
            text: options.text,
            html: options.html || options.text,
            cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
            bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
            attachments: options.attachments,
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

export const verifyEmailConfig = async (): Promise<boolean> => {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        return true;
    } catch (error) {
        return false;
    }
};
