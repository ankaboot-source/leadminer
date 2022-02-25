const regex = new RegExp(
  /("*(?<name>[,\p{L}\p{M}\d\s\(\)-]{1,})"*\s)*(<|\[)*(mailto:)*(?<address>[A-Za-z0-9!#$%&'+\/=?^_`\{|\}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`\{|\}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9,\s])?)(>|\])*/dgimu
);

matchRegexp = (ImapData) => {
  let m;
  let dataAfterRegEx;

  dataAfterRegEx = ImapData.map((data, index) => {
    //console.log(data, index);
    m = regex.exec(data);
    if (m == null || m["groups"] == null) {
      return null;
    } else {
      return m["groups"];
    }
  });
  // remove duplicates
  dataAfterRegEx = dataAfterRegEx.filter(
    (v, i, a) =>
      a.findIndex((t) => JSON.stringify(t) === JSON.stringify(v)) === i
  );
  // remove null values then return data
  return dataAfterRegEx.filter((item) => item);
};

exports.matchRegexp = matchRegexp;
