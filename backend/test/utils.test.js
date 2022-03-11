const expect = require("chai").expect;
const utils = require("../app/utils/regexp");

const testData = [
  "leadminer team <leadminer-team@leadminer.io>",
  "русский язык <leadminer-team@leadminer.io>",
  "لغة عربية <leadminer-team@leadminer.io>",
];
describe("utils.matchRegexp(data)", async function () {
  it("should return {name,address} if given a valid name and email", async function () {
    const input = testData[0];
    const output = await utils.matchRegexp([input]);
    expect(output[0].name).to.eq("leadminer team");
    expect(output[0].address).to.eq("leadminer-team@leadminer.io");
  });
  testData.forEach((input) => {
    it("should detect unicode in name field case :" + input, async function () {
      const output = await utils.matchRegexp([input]);
      expect(output[0].name).to.eq(input.substring(0, input.indexOf("<") - 1));
    });
  });
});

describe("utils.matchRegexp(data)", async function () {
  it("should return {name,address} if given a valid name and email", async function () {
    const input = testData[0];
    const output = await utils.matchRegexp([input]);
    expect(output[0].name).to.eq("leadminer team");
    expect(output[0].address).to.eq("leadminer-team@leadminer.io");
  });
  testData.forEach((input) => {
    it("should detect unicode in name field case :" + input, async function () {
      const output = await utils.matchRegexp([input]);
      expect(output[0].name).to.eq(input.substring(0, input.indexOf("<") - 1));
    });
  });
});

describe("utils.getPath(folders , folder)", async function () {
  it("should return path if given a valid folders object", async function () {
    const input = [
      { label: "Brouillons" },
      { label: "Corbeille" },
      {
        label: "INBOX",
        children: [
          {
            label: "test",
            children: [
              {
                label: "test2",
              },
            ],
          },
        ],
      },
      { label: "Spam" },
    ];
    let output = await utils.getPath(input, "Spam");
    expect(output.substring(1)).eq("Spam");
    let output2 = await utils.getPath(input, "test2");
    expect(output2.substring(1)).eq("INBOX/test/test2");
  });
});
