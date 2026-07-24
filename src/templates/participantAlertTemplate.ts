export const participantAlertTemplate = (missionDetails: any, participantName: string) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
        h2 { color: #8B6914; border-bottom: 2px solid #8B6914; padding-bottom: 10px; }
        .details { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .details p { margin: 5px 0; }
        .footer { font-size: 12px; color: #777; text-align: center; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h2>New Local Mission Participant Request</h2>
        <p>A new user has requested to join a local mission.</p>
        
        <div class="details">
            <p><strong>Participant:</strong> ${participantName || 'A user'}</p>
            <p><strong>Mission Title:</strong> ${missionDetails.title || 'Unknown Mission'}</p>
            <p><strong>Mission Location:</strong> ${missionDetails.location || 'N/A'}</p>
            <p><strong>Date of Request:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <p>Please log in to the admin dashboard to review and approve or reject this request.</p>
        
        <div class="footer">
            <p>This is an automated message from the Hesteka platform.</p>
        </div>
    </div>
</body>
</html>
`;
