export const reportAlertTemplate = (reportDetails: any) => `
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
        <h2>New Animal Report Alert</h2>
        <p>A new animal report has just been created on Hesteka.</p>
        
        <div class="details">
            <p><strong>Report Type:</strong> ${reportDetails.type || 'N/A'}</p>
            <p><strong>Animal Name:</strong> ${reportDetails.animalName || 'Unknown'}</p>
            <p><strong>Location:</strong> ${reportDetails.location || 'N/A'}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <p>Please log in to the admin dashboard to view the full details and manage this report.</p>
        
        <div class="footer">
            <p>This is an automated message from the Hesteka platform.</p>
        </div>
    </div>
</body>
</html>
`;
