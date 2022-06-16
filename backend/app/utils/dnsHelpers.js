const dns = require("dns");

async function checkDNS(domain, redis) {
  if (domain) {
    return new Promise((resolve, reject) => {
      dns.resolveMx(domain, async (error, addresses) => {
        if (addresses) {
          if (addresses.length > 0) {
            //set domain in redis
            redis.set(domain, "ok", {
              EX: 864000,
            });
            resolve("ok");
          }
        } else {
          resolve("ko");
        }
      });
    });
  } else {
    return "ko";
  }
}
module.exports = {
  checkDNS,
};
