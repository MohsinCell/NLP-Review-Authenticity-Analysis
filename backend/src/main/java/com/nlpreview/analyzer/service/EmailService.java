package com.nlpreview.analyzer.service;

import com.nlpreview.analyzer.config.AppProperties;
import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.CreateEmailOptions;
import com.resend.services.emails.model.CreateEmailResponse;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final AppProperties appProperties;

    private Resend resend;
    private boolean isResendEnabled = false;
    private static String lastOtp = "";

    private static final String SENDER_SECURITY = "ReviewIQ Security <noreply@reviewiq.website>";
    private static final String SENDER_WELCOME = "ReviewIQ <noreply@reviewiq.website>";
    private static final String SENDER_SUPPORT = "ReviewIQ Support <noreply@reviewiq.website>";
    private static final String SENDER_SYSTEM = "ReviewIQ System <noreply@reviewiq.website>";

    @PostConstruct
    public void init() {
        String apiKey = appProperties.getResend() != null ? appProperties.getResend().getApiKey() : null;
        if (apiKey != null && !apiKey.isBlank()) {
            resend = new Resend(apiKey);
            isResendEnabled = true;
            log.info("Resend email service enabled with from: {}", appProperties.getResend().getFromEmail());
        } else {
            log.warn("Resend API key not configured - emails will be logged only");
        }
    }

    public boolean sendOtpEmail(String toEmail, String otp) {
        lastOtp = otp;
        int expiryMinutes = appProperties.getOtp().getExpirationMinutes();
        String subject = "Your ReviewIQ Verification Code";
        String html = buildOtpEmailHtml(otp, expiryMinutes);
        return sendEmail(toEmail, subject, html, SENDER_SECURITY);
    }

    @Async
    public void sendWelcomeEmail(String toEmail, String fullName) {
        String subject = "Welcome to ReviewIQ - Your Account is Ready";
        String html = buildWelcomeEmailHtml(fullName);
        sendEmail(toEmail, subject, html, SENDER_WELCOME);
    }

    @Async
    public void sendContactConfirmationEmail(String toEmail, String firstName, String subject) {
        String emailSubject = "We've Received Your Message - ReviewIQ";
        String html = buildContactConfirmationHtml(firstName, subject);
        sendEmail(toEmail, emailSubject, html, SENDER_SUPPORT);
    }

    @Async
    public void sendContactAdminNotification(String firstName, String lastName, String email, String subject, String message) {
        String adminEmail = appProperties.getResend().getAdminEmail();
        if (adminEmail == null || adminEmail.isBlank()) {
            log.debug("No admin email configured - skipping contact notification");
            return;
        }
        String emailSubject = "New Contact Form Submission: " + subject;
        String html = buildContactAdminNotificationHtml(firstName, lastName, email, subject, message);
        sendEmail(adminEmail, emailSubject, html, SENDER_SYSTEM);
    }

    @Async
    public void sendPasswordChangedEmail(String toEmail, String fullName) {
        String subject = "Your ReviewIQ Password Was Changed";
        String html = buildPasswordChangedHtml(fullName);
        sendEmail(toEmail, subject, html, SENDER_SECURITY);
    }

    public boolean sendDeleteAccountOtpEmail(String toEmail, String otp) {
        lastOtp = otp;
        int expiryMinutes = appProperties.getOtp().getExpirationMinutes();
        String subject = "ReviewIQ Account Deletion Verification";
        String html = buildDeleteAccountOtpHtml(otp, expiryMinutes);
        return sendEmail(toEmail, subject, html, SENDER_SECURITY);
    }

    @Async
    public void sendAccountDeletedEmail(String toEmail, String fullName) {
        String subject = "Your ReviewIQ Account Has Been Deleted";
        String html = buildAccountDeletedHtml(fullName);
        sendEmail(toEmail, subject, html, SENDER_WELCOME);
    }

    @Async
    public void sendCookieExpiryNotification(String siteName, String domain, String message) {
        String adminEmail = appProperties.getResend().getAdminEmail();
        if (adminEmail == null || adminEmail.isBlank()) {
            log.debug("No admin email configured - skipping cookie expiry notification");
            return;
        }
        String subject = "Cookie Alert: " + siteName + " Cookies Expired";
        String html = buildCookieExpiryHtml(siteName, domain, message);
        sendEmail(adminEmail, subject, html, SENDER_SYSTEM);
    }

    private boolean sendEmail(String toEmail, String subject, String html, String from) {
        if (!isResendEnabled) {
            log.info("=== EMAIL (Dev Mode) ===");
            log.info("From: {} | To: {} | Subject: {}", from, toEmail, subject);
            log.info("========================");
            return false;
        }

        try {
            CreateEmailOptions params = CreateEmailOptions.builder()
                    .from(from)
                    .to(toEmail)
                    .subject(subject)
                    .html(html)
                    .build();

            CreateEmailResponse response = resend.emails().send(params);
            log.info("Email sent via Resend [from={}] to: {} [id={}]", from, toEmail, response.getId());
            return true;
        } catch (ResendException e) {
            log.error("Failed to send email via Resend to {}: {}", toEmail, e.getMessage());
            return false;
        }
    }

    public static String getLastOtp() {
        return lastOtp;
    }

    public boolean isTestingMode() {
        return !isResendEnabled;
    }

    private String baseLayout(String headerTitle, String headerSubtitle, String bodyContent) {
        return """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta name="color-scheme" content="dark">
            <title>ReviewIQ</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #000000; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
            <table width="100%%" border="0" cellspacing="0" cellpadding="0" bgcolor="#000000" style="background-color: #000000;">
                <tr>
                    <td bgcolor="#000000" style="background-color: #000000; background: radial-gradient(ellipse at top center, rgba(255,255,255,0.06) 0%%, transparent 50%%); padding: 0;">
                        <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                                <td bgcolor="#000000" style="background-color: #000000; background: radial-gradient(circle at 80%% 60%%, rgba(255,255,255,0.03) 0%%, transparent 40%%); padding: 0;">
                                    <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                                        <tr>
                                            <td bgcolor="#000000" style="background-color: #000000; background: radial-gradient(circle at 20%% 80%%, rgba(255,255,255,0.025) 0%%, transparent 40%%); padding: 0;">

                                                <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                                                    <tr>
                                                        <td align="center" style="padding: 0;">
                                                            <div style="height: 1px; max-width: 560px; margin: 0 auto; background: linear-gradient(90deg, transparent 0%%, #262626 50%%, transparent 100%%);"></div>
                                                        </td>
                                                    </tr>
                                                </table>

                                                <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                                                    <tr>
                                                        <td align="center" bgcolor="#000000" style="padding: 48px 16px;">
                                                            <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto;">

                                                                <tr>
                                                                    <td align="center" style="padding-bottom: 32px;">
                                                                        <table border="0" cellspacing="0" cellpadding="0" align="center">
                                                                            <tr>
                                                                                <td bgcolor="#ffffff" style="background-color: #ffffff; border-radius: 12px; padding: 12px 24px;">
                                                                                    <span style="font-size: 22px; font-weight: 700; color: #000000; letter-spacing: -0.5px;">ReviewIQ</span>
                                                                                </td>
                                                                            </tr>
                                                                        </table>
                                                                    </td>
                                                                </tr>

                                                                <tr>
                                                                    <td align="center">
                                                                        <table width="100%%" border="0" cellspacing="0" cellpadding="0" bgcolor="#0d0d0d" style="background-color: #0d0d0d; background: linear-gradient(145deg, rgba(255,255,255,0.08) 0%%, rgba(255,255,255,0.03) 100%%); border-radius: 20px; border: 1px solid #1a1a1a; overflow: hidden; margin: 0 auto;">

                                                                            <tr>
                                                                                <td align="center" bgcolor="#141414" style="background-color: #141414; background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%%, rgba(255,255,255,0.04) 100%%); padding: 40px 40px 32px; border-bottom: 1px solid #141414; text-align: center;">
                                                                                    <h1 style="margin: 0 0 8px; color: #ffffff; font-size: 28px; font-weight: 700; line-height: 1.2; letter-spacing: -0.5px; text-align: center;">%s</h1>
                                                                                    <p style="margin: 0; color: #999999; font-size: 15px; font-weight: 400; text-align: center;">%s</p>
                                                                                </td>
                                                                            </tr>

                                                                            <tr>
                                                                                <td bgcolor="#0d0d0d" style="background-color: #0d0d0d; padding: 36px 40px 44px; text-align: center;">
                                                                                    %s
                                                                                </td>
                                                                            </tr>
                                                                        </table>
                                                                    </td>
                                                                </tr>

                                                                <tr>
                                                                    <td align="center" style="padding: 24px 0 0;">
                                                                        <div style="height: 1px; max-width: 200px; margin: 0 auto; background: linear-gradient(90deg, transparent 0%%, #1a1a1a 50%%, transparent 100%%);"></div>
                                                                    </td>
                                                                </tr>

                                                                <tr>
                                                                    <td align="center" style="padding: 20px 20px 0; text-align: center;">
                                                                        <p style="margin: 0 0 8px; color: #595959; font-size: 13px; line-height: 1.5; text-align: center;">
                                                                            This is an automated message from ReviewIQ. Please do not reply to this email.
                                                                        </p>
                                                                        <p style="margin: 0; color: #333333; font-size: 12px; text-align: center;">
                                                                            &copy; %d ReviewIQ &middot; Powered by Advanced NLP Technology
                                                                        </p>
                                                                    </td>
                                                                </tr>

                                                            </table>
                                                        </td>
                                                    </tr>
                                                </table>

                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """.formatted(headerTitle, headerSubtitle, bodyContent, java.time.Year.now().getValue());
    }

    private String buildOtpEmailHtml(String otp, int expiryMinutes) {
        String body = """
                <p style="margin: 0 0 28px; color: #bfbfbf; font-size: 15px; line-height: 1.8; text-align: center;">
                    Use the verification code below to complete your request. This code is valid for
                    <strong style="color: #ffffff;">%d minutes</strong> and can only be used once.
                </p>

                <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                    <tr>
                        <td bgcolor="#0f0f0f" style="background-color: #0f0f0f; background: linear-gradient(145deg, rgba(255,255,255,0.1) 0%%, rgba(255,255,255,0.04) 100%%); border: 1px solid #262626; border-radius: 16px; padding: 32px; text-align: center;">
                            <p style="margin: 0 0 12px; color: #808080; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 3px; text-align: center;">Verification Code</p>
                            <p style="margin: 0; font-size: 44px; font-weight: 800; color: #ffffff; letter-spacing: 12px; font-family: 'SF Mono', 'Courier New', Courier, monospace; text-align: center;">%s</p>
                        </td>
                    </tr>
                </table>

                <table width="100%%" border="0" cellspacing="0" cellpadding="0" bgcolor="#0a0a0a" style="background-color: #0a0a0a; border-radius: 12px; border: 1px solid #141414;">
                    <tr>
                        <td style="padding: 16px 20px;">
                            <p style="margin: 0; color: #8c8c8c; font-size: 13px; line-height: 1.6; text-align: center;">
                                <strong style="color: #b3b3b3;">Security tip:</strong> Never share this code with anyone. ReviewIQ will never ask for your verification code via phone or chat.
                            </p>
                        </td>
                    </tr>
                </table>
        """.formatted(expiryMinutes, otp);

        return baseLayout("Email Verification", "Confirm your identity to continue", body);
    }

    private String buildWelcomeEmailHtml(String fullName) {
        String firstName = fullName.contains(" ") ? fullName.substring(0, fullName.indexOf(' ')) : fullName;
        String body = """
                <p style="margin: 0 0 20px; color: #bfbfbf; font-size: 15px; line-height: 1.8; text-align: center;">
                    Hi <strong style="color: #ffffff;">%s</strong>, welcome aboard! Your ReviewIQ account has been successfully created.
                </p>

                <p style="margin: 0 0 32px; color: #bfbfbf; font-size: 15px; line-height: 1.8; text-align: center;">
                    ReviewIQ uses advanced Natural Language Processing to help you detect fake reviews and analyze review authenticity across major e-commerce platforms.
                </p>

                <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                    <tr>
                        <td bgcolor="#0a0a0a" style="background-color: #0a0a0a; background: linear-gradient(145deg, rgba(255,255,255,0.06) 0%%, rgba(255,255,255,0.02) 100%%); border-radius: 16px; padding: 24px 26px; border: 1px solid #141414;">
                            <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td style="padding-bottom: 18px; text-align: center;">
                                        <p style="margin: 0 0 6px; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; text-align: center;">Analyze Reviews</p>
                                        <p style="margin: 0; color: #808080; font-size: 14px; line-height: 1.6; text-align: center;">Paste any product review or URL to get an instant authenticity score.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="border-top: 1px solid #141414; padding: 18px 0; text-align: center;">
                                        <p style="margin: 0 0 6px; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; text-align: center;">Smart Detection</p>
                                        <p style="margin: 0; color: #808080; font-size: 14px; line-height: 1.6; text-align: center;">Our AI models identify patterns in language, sentiment, and writing style.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="border-top: 1px solid #141414; padding-top: 18px; text-align: center;">
                                        <p style="margin: 0 0 6px; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; text-align: center;">Detailed Reports</p>
                                        <p style="margin: 0; color: #808080; font-size: 14px; line-height: 1.6; text-align: center;">Get comprehensive breakdowns with confidence scores and analysis insights.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <p style="margin: 0; color: #808080; font-size: 14px; line-height: 1.7; text-align: center;">
                    If you have any questions, feel free to reach out through our contact page. We're happy to help!
                </p>
        """.formatted(escapeHtml(firstName));

        return baseLayout("Welcome to ReviewIQ!", "Your account is ready to go", body);
    }

    private String buildContactConfirmationHtml(String firstName, String messageSubject) {
        String body = """
                <p style="margin: 0 0 20px; color: #bfbfbf; font-size: 15px; line-height: 1.8; text-align: center;">
                    Hi <strong style="color: #ffffff;">%s</strong>, thank you for reaching out to us!
                </p>

                <p style="margin: 0 0 28px; color: #bfbfbf; font-size: 15px; line-height: 1.8; text-align: center;">
                    We've received your message and our team will review it shortly. You can expect a response within <strong style="color: #ffffff;">24-48 hours</strong>.
                </p>

                <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                    <tr>
                        <td bgcolor="#0a0a0a" style="background-color: #0a0a0a; border-radius: 12px; border: 1px solid #141414; padding: 20px 24px; text-align: center;">
                            <p style="margin: 0 0 6px; color: #666666; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; text-align: center;">Your Message Subject</p>
                            <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 500; text-align: center;">%s</p>
                        </td>
                    </tr>
                </table>

                <p style="margin: 0; color: #808080; font-size: 14px; line-height: 1.7; text-align: center;">
                    There's no need to send a follow-up. We have your message and will get back to you as soon as possible.
                </p>
        """.formatted(escapeHtml(firstName), escapeHtml(messageSubject));

        return baseLayout("Message Received", "We'll get back to you soon", body);
    }

    private String buildContactAdminNotificationHtml(String firstName, String lastName, String email, String subject, String message) {
        String body = """
                <p style="margin: 0 0 24px; color: #bfbfbf; font-size: 15px; line-height: 1.8; text-align: center;">
                    A new contact form submission has been received on ReviewIQ.
                </p>

                <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                    <tr>
                        <td bgcolor="#0a0a0a" style="background-color: #0a0a0a; background: linear-gradient(145deg, rgba(255,255,255,0.06) 0%%, rgba(255,255,255,0.02) 100%%); border-radius: 16px; padding: 24px 26px; border: 1px solid #141414;">
                            <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td style="padding-bottom: 16px; text-align: center;">
                                        <p style="margin: 0 0 4px; color: #666666; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; text-align: center;">From</p>
                                        <p style="margin: 0; color: #ffffff; font-size: 15px; text-align: center;">%s %s &lt;%s&gt;</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="border-top: 1px solid #141414; padding: 16px 0; text-align: center;">
                                        <p style="margin: 0 0 4px; color: #666666; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; text-align: center;">Subject</p>
                                        <p style="margin: 0; color: #ffffff; font-size: 15px; font-weight: 500; text-align: center;">%s</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="border-top: 1px solid #141414; padding-top: 16px; text-align: center;">
                                        <p style="margin: 0 0 4px; color: #666666; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; text-align: center;">Message</p>
                                        <p style="margin: 0; color: #bfbfbf; font-size: 15px; line-height: 1.7; white-space: pre-wrap; text-align: center;">%s</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <p style="margin: 0; color: #737373; font-size: 13px; text-align: center;">
                    Reply directly to <strong style="color: #a6a6a6;">%s</strong> to respond to this inquiry.
                </p>
        """.formatted(
                escapeHtml(firstName), escapeHtml(lastName), escapeHtml(email),
                escapeHtml(subject), escapeHtml(message), escapeHtml(email)
        );

        return baseLayout("New Contact Submission", "Someone reached out via the contact form", body);
    }

    private String buildPasswordChangedHtml(String fullName) {
        String firstName = fullName.contains(" ") ? fullName.substring(0, fullName.indexOf(' ')) : fullName;
        String body = """
                <p style="margin: 0 0 24px; color: #bfbfbf; font-size: 15px; line-height: 1.8; text-align: center;">
                    Hi <strong style="color: #ffffff;">%s</strong>, this is a confirmation that your ReviewIQ account password was successfully changed.
                </p>

                <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                    <tr>
                        <td bgcolor="#1a0808" style="background-color: #1a0808; border-radius: 12px; border: 1px solid #3d1616; padding: 18px 22px;">
                            <p style="margin: 0; color: #e6a3a3; font-size: 13px; line-height: 1.6; text-align: center;">
                                <strong style="color: #fca5a5;">Didn't make this change?</strong> If you did not change your password, your account may be compromised. Please contact us immediately through our contact page.
                            </p>
                        </td>
                    </tr>
                </table>

                <p style="margin: 0; color: #808080; font-size: 14px; line-height: 1.7; text-align: center;">
                    For your security, all active sessions have been signed out. You'll need to log in again with your new password.
                </p>
        """.formatted(escapeHtml(firstName));

        return baseLayout("Password Changed", "Your account password has been updated", body);
    }

    private String buildDeleteAccountOtpHtml(String otp, int expiryMinutes) {
        String body = """
                <p style="margin: 0 0 28px; color: #bfbfbf; font-size: 15px; line-height: 1.8; text-align: center;">
                    You have requested to <strong style="color: #ef4444;">permanently delete</strong> your ReviewIQ account.
                    Use the verification code below to confirm this action. This code is valid for
                    <strong style="color: #ffffff;">%d minutes</strong>.
                </p>

                <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                    <tr>
                        <td bgcolor="#180808" style="background-color: #180808; background: linear-gradient(145deg, rgba(239,68,68,0.15) 0%%, rgba(239,68,68,0.05) 100%%); border: 1px solid #4d1a1a; border-radius: 16px; padding: 32px; text-align: center;">
                            <p style="margin: 0 0 12px; color: #808080; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 3px; text-align: center;">Deletion Code</p>
                            <p style="margin: 0; font-size: 44px; font-weight: 800; color: #ef4444; letter-spacing: 12px; font-family: 'SF Mono', 'Courier New', Courier, monospace; text-align: center;">%s</p>
                        </td>
                    </tr>
                </table>

                <table width="100%%" border="0" cellspacing="0" cellpadding="0" bgcolor="#140606" style="background-color: #140606; border-radius: 12px; border: 1px solid #2f1111;">
                    <tr>
                        <td style="padding: 16px 20px;">
                            <p style="margin: 0; color: #e6a3a3; font-size: 13px; line-height: 1.6; text-align: center;">
                                <strong style="color: #fca5a5;">Warning:</strong> This action is irreversible. All your data, including analysis history, will be permanently deleted and cannot be recovered.
                            </p>
                        </td>
                    </tr>
                </table>
        """.formatted(expiryMinutes, otp);

        return baseLayout("Account Deletion Request", "Confirm your identity to delete your account", body);
    }

    private String buildAccountDeletedHtml(String fullName) {
        String firstName = fullName.contains(" ") ? fullName.substring(0, fullName.indexOf(' ')) : fullName;
        String body = """
                <p style="margin: 0 0 24px; color: #bfbfbf; font-size: 15px; line-height: 1.8; text-align: center;">
                    Hi <strong style="color: #ffffff;">%s</strong>, this email confirms that your ReviewIQ account has been permanently deleted.
                </p>

                <table width="100%%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                    <tr>
                        <td bgcolor="#0a0a0a" style="background-color: #0a0a0a; background: linear-gradient(145deg, rgba(255,255,255,0.06) 0%%, rgba(255,255,255,0.02) 100%%); border-radius: 16px; padding: 24px 26px; border: 1px solid #141414;">
                            <table width="100%%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td style="padding-bottom: 16px; text-align: center;">
                                        <p style="margin: 0 0 6px; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; text-align: center;">What was deleted</p>
                                        <p style="margin: 0; color: #808080; font-size: 14px; line-height: 1.6; text-align: center;">Your account profile, analysis history, and all associated data.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="border-top: 1px solid #141414; padding-top: 16px; text-align: center;">
                                        <p style="margin: 0 0 6px; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; text-align: center;">Want to come back?</p>
                                        <p style="margin: 0; color: #808080; font-size: 14px; line-height: 1.6; text-align: center;">You're always welcome to create a new account at ReviewIQ.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <p style="margin: 0; color: #808080; font-size: 14px; line-height: 1.7; text-align: center;">
                    Thank you for using ReviewIQ. We're sorry to see you go.
                </p>
        """.formatted(escapeHtml(firstName));

        return baseLayout("Account Deleted", "Your ReviewIQ account has been removed", body);
    }

    private String buildCookieExpiryHtml(String siteName, String domain, String message) {
        String timestamp = java.time.LocalDateTime.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy 'at' HH:mm"));
        String safeSiteName = escapeHtml(siteName);
        String safeDomain = escapeHtml(domain);
        String safeMessage = escapeHtml(message);

        String body = "<p style=\"margin: 0 0 24px; color: #bfbfbf; font-size: 15px; line-height: 1.8; text-align: center;\">"
                + "The scraper cookies for <strong style=\"color: #ffffff;\">" + safeSiteName + "</strong> have expired and need to be refreshed to continue scraping reviews."
                + "</p>"
                + "<table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin-bottom: 28px;\">"
                + "<tr><td bgcolor=\"#1a1205\" style=\"background-color: #1a1205; background: linear-gradient(145deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.04) 100%); border-radius: 16px; padding: 24px 26px; border: 1px solid #332006;\">"
                + "<table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\">"
                + "<tr><td style=\"padding-bottom: 16px; text-align: center;\">"
                + "<p style=\"margin: 0 0 4px; color: #666666; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; text-align: center;\">Site</p>"
                + "<p style=\"margin: 0; color: #ffffff; font-size: 15px; font-weight: 500; text-align: center;\">" + safeSiteName + " (" + safeDomain + ")</p>"
                + "</td></tr>"
                + "<tr><td style=\"border-top: 1px solid #271905; padding: 16px 0; text-align: center;\">"
                + "<p style=\"margin: 0 0 4px; color: #666666; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; text-align: center;\">Status</p>"
                + "<p style=\"margin: 0; color: #f59e0b; font-size: 15px; font-weight: 600; text-align: center;\">" + safeMessage + "</p>"
                + "</td></tr>"
                + "<tr><td style=\"border-top: 1px solid #271905; padding-top: 16px; text-align: center;\">"
                + "<p style=\"margin: 0 0 4px; color: #666666; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; text-align: center;\">Detected At</p>"
                + "<p style=\"margin: 0; color: #bfbfbf; font-size: 15px; text-align: center;\">" + escapeHtml(timestamp) + "</p>"
                + "</td></tr>"
                + "</table></td></tr></table>"
                + "<p style=\"margin: 0; color: #808080; font-size: 14px; line-height: 1.7; text-align: center;\">"
                + "Log in to the ReviewIQ admin panel and navigate to <strong style=\"color: #b3b3b3;\">Admin &gt; Cookies</strong> to import fresh cookies for this site."
                + "</p>";

        return baseLayout("Cookie Expiry Alert", "Action required: scraper cookies need renewal", body);
    }

    private static String escapeHtml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                     .replace("<", "&lt;")
                     .replace(">", "&gt;")
                     .replace("\"", "&quot;")
                     .replace("'", "&#39;");
    }
}
