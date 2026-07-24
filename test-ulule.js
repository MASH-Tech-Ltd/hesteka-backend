require('dotenv').config();
const axios = require('axios');

async function test() {
  const apiKey = process.env.ULULE_API_KEY;
  const projectSlug = "hesteka";
  try {
    const res = await axios.get(`https://api.ulule.com/v1/projects/${projectSlug}/orders`, {
      headers: { Authorization: `APIKey ${apiKey}` }
    });
    console.log("Total orders fetched:", res.data.orders ? res.data.orders.length : 0);
    console.log("Meta:", res.data.meta);
    if (res.data.orders && res.data.orders.length > 0) {
      console.log("First order keys:", Object.keys(res.data.orders[0]));
      console.log("First order details:");
      console.log(JSON.stringify(res.data.orders[0], null, 2));
    }
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
