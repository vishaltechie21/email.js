import express from 'express';
import cors from 'cors';
import path from 'path';
import { sendEmail, IntegrationEmailConfig } from './utils/email';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Allow all origins explicitly for this setup
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.post('/api/send-email', async (req, res) => {
    try {
        const {
            smtpHost,
            smtpPort,
            smtpUser,
            smtpPass,
            fromEmail,
            fromName,
            to,
            subject,
            message
        } = req.body;

        const integrationConfig: IntegrationEmailConfig = {
            smtp_host: smtpHost,
            smtp_port: Number(smtpPort),
            smtp_user: smtpUser,
            smtp_password: smtpPass,
            from_email: fromEmail,
            from_name: fromName
        };

        await sendEmail({
            to,
            subject,
            text: message,
            html: `<p>${message}</p>`,
            integrationConfig,
            from: fromEmail,
            fromName: fromName
        });

        res.json({ success: true, message: 'Email sent successfully!' });
    } catch (error) {
        console.error('Email send error:', error);
        res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to send email' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
