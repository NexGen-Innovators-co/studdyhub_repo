// api/og.js
export default async function handler(req, res) {
    const { title, description, type } = req.query;

    // Return a simple HTML image (or use @vercel/og for better images)
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              margin: 0;
              padding: 40px;
              width: 1200px;
              height: 630px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }
            .logo {
              font-size: 48px;
              font-weight: bold;
              margin-bottom: 20px;
              color: white;
            }
            .title {
              font-size: 64px;
              font-weight: bold;
              line-height: 1.2;
              margin-bottom: 20px;
            }
            .description {
              font-size: 36px;
              opacity: 0.9;
              line-height: 1.4;
            }
            .url {
              position: absolute;
              bottom: 40px;
              right: 40px;
              font-size: 24px;
              opacity: 0.7;
            }
          </style>
        </head>
        <body>
          <div class="logo">StuddyHub</div>
          <div class="title">${title || 'Social Learning Platform'}</div>
          <div class="description">${description || 'AI-powered study tools and social learning for students'}</div>
          <div class="url">studdyhub.vercel.app</div>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
}