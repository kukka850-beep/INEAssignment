const fetch = require('node-fetch');


function detectAlert(previous, current) {
  if (!previous || !current) return null;
  if (current.price == null) return null;

  const alerts = [];

  if (previous.price != null && current.price < previous.price) {
    alerts.push({
      type: 'price_drop',
      message: `Price dropped from ₹${Number(previous.price).toFixed(2)} to ₹${Number(current.price).toFixed(2)}`,
      previousPrice: previous.price,
      newPrice: current.price,
    });
  }

  if (previous.stock === 'out_of_stock' && current.stock === 'in_stock') {
    alerts.push({ type: 'back_in_stock', message: 'Back in stock' });
  }

  return alerts.length > 0 ? alerts : null;
}


async function sendEmailAlert({ productName, optionLabel, alerts }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  const from = process.env.ALERT_EMAIL_FROM;
  if (!apiKey || !to || !from) return { sent: false, reason: 'SendGrid not configured' };

  const summary = alerts.map((a) => a.message).join('; ');
  const body = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from },
    subject: `Price alert: ${productName} (${optionLabel})`,
    content: [{ type: 'text/plain', value: summary }],
  };

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { sent: res.ok, status: res.status };
  } catch (err) {
    console.error('[alerts] SendGrid send failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { detectAlert, sendEmailAlert };
