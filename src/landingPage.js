'use strict';

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));

const landingPage = (url) => {
  const safeUrl = escapeHtml(url);

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="description" content="Landing Page - Plex Webhooks Homebridge Plugin">
        <title>Plex Webhooks - Homebridge Plugin</title>
        <style>
          html, body {
            width: 100%;
            height: 100%;
            background-color: rgb(31, 35, 38);
            color: rgb(255, 255, 255);
            font-family: "Open Sans Bold", "Helvetica Neue", Helvetica, Arial, sans-serif;
            font-size: 14px;
            font-weight: normal;
            margin: 0;
            padding: 0;
          }
          .container {
            display: flex;
            align-items: center;
            width: 100%;
            height: 100%;
            justify-content: center;
            flex-direction: column;
            text-align: center;
          }
          input {
            background-color: rgba(255, 255, 255, 0.08);
            color: rgb(238, 238, 238);
            border-radius: 4px;
            font-size: 14px;
            height: 40px;
            padding: 4px 1em;
            transition: 0.2s ease;
            width: 280px;
            outline: none;
            border: none;
            box-sizing: border-box;
            text-align: center;
          }
          input:focus {
            background-color: rgb(238, 238, 238);
            color: rgb(85, 85, 85);
          }
          a {
            color: #cc7b19;
            text-decoration: none;
            transition: color .2s;
          }
          a:hover {
            color: #fff;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <p>Add this URL on the<br />
            <a href="https://app.plex.tv/desktop#!/settings/webhooks" target="_blank"
              >Webhooks page</a> of your Plex Media Server:
          </p>
          <input class="input" type="text" value="${safeUrl}" onClick="this.select()" />
        </div>
      </body>
    </html>
  `;
};

module.exports = landingPage;