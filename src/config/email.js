import nodemailer from 'nodemailer';
import hbs from 'nodemailer-express-handlebars';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transporter = process.env.NODE_ENV === 'test' 
  ? nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true
    })
  : nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

// Verify connection configuration
if (process.env.NODE_ENV !== 'test') {
  transporter.verify((error, success) => {
    if (error) {
      logger.error('SMTP Connection Error:', error);
    } else {
      logger.info('Server is ready to take our messages');
    }
  });
} else {
  logger.info('SMTP Verification skipped in test environment');
}

const handlebarOptions = {
  viewEngine: {
    extName: '.hbs',
    partialsDir: path.resolve(__dirname, '../views/'),
    defaultLayout: false,
  },
  viewPath: path.resolve(__dirname, '../views/'),
  extName: '.hbs',
};

transporter.use('compile', hbs(handlebarOptions));

export const sendEmail = async ({ to, subject, template, context }) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Opportunity Circle" <no-reply@opportunitycircle.com>',
      to,
      subject,
      template,
      context,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error('Error sending email:', error);
    throw error;
  }
};

export default transporter;
