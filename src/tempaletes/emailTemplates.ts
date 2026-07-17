export const getNewSupportRequestTemplate = (data: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3a2a1a; border: 1px solid #e8ddd0; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #fcfaf7; padding: 20px; text-align: center; border-bottom: 1px solid #e8ddd0;">
        <h2 style="margin: 0; color: #3a2a1a;">New Support Request</h2>
      </div>
      <div style="padding: 20px;">
        <p><strong>From:</strong> ${data.name} (${data.email})</p>
        <p><strong>Subject:</strong> ${data.subject}</p>
        <div style="padding: 15px; background-color: #f5f5f5; border-left: 4px solid #d3b89e; margin: 20px 0; border-radius: 4px;">
          <p style="white-space: pre-wrap; margin: 0; line-height: 1.5;">${data.message}</p>
        </div>
        <p style="font-size: 14px; color: #9a8a7a;">You can reply to this message directly from the HESTEKA admin panel.</p>
      </div>
    </div>
  `;
};

export const getSupportReplyTemplate = (data: {
  name: string;
  subject: string;
  question: string;
  replyMessage: string;
}) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3a2a1a; border: 1px solid #e8ddd0; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #fcfaf7; padding: 20px; text-align: center; border-bottom: 1px solid #e8ddd0;">
        <h2 style="margin: 0; color: #3a2a1a;">Support Reply</h2>
      </div>
      <div style="padding: 20px;">
        <p>Hi <strong>${data.name}</strong>,</p>
        <p>An admin has replied to your recent support ticket regarding <strong>"${data.subject}"</strong>:</p>
        <div style="padding: 15px; background-color: #faf7f2; border-left: 4px solid #e8ddd0; margin: 20px 0; border-radius: 4px; color: #7a6a5a; font-style: italic;">
          <p style="margin: 0 0 5px 0; font-size: 12px; font-weight: bold; text-transform: uppercase;">Your Message:</p>
          <p style="white-space: pre-wrap; margin: 0; line-height: 1.5; font-size: 14px;">${data.question}</p>
        </div>
        <div style="padding: 15px; background-color: #f5f5f5; border-left: 4px solid #d3b89e; margin: 20px 0; border-radius: 4px;">
          <p style="white-space: pre-wrap; margin: 0; line-height: 1.5;">${data.replyMessage}</p>
        </div>
        <p>Best regards,<br/><strong>HESTEKA Support Team</strong></p>
      </div>
    </div>
  `;
};
