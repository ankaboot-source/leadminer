export async function getEmails({ context, getters }, { data }) {
  const currentState = getters.getStates;
  const source = new EventSource(`${this.$api}/stream`);
  source.addEventListener("box", (message) => {
    this.commit("example/SET_PERCENTAGE", 0);
    this.commit("example/SET_CURRENT", message.data);
  });
  source.addEventListener("percentage", (message) => {
    this.commit("example/SET_PERCENTAGE", message.data);
  });

  source.addEventListener("data", (message) => {
    this.commit("example/SET_EMAILS", JSON.parse(message.data));
  });
  source.addEventListener("dns", (message) => {
    const emails = () => {
      let data = currentState.retrievedEmails.map((row) => {
        if (!row.email.hasOwnProperty("name")) {
          row.email["name"] = "";
        } else {
          row.email.name.replace(/'/g, ``);
        }
        row.field["total"] = 0;
        let countSender = 0;
        let countbody = 0;
        let countrecipient = 0;
        Object.keys(row.field).map((field) => {
          console.log(field);
          if (field.includes("from") || field.includes("reply-to")) {
            countSender += row.field[field];
            console.log(countSender, row.field[field]);
          } else if (
            field.includes("cc") ||
            field.includes("to") ||
            field.includes("bcc")
          ) {
            countrecipient += row.field[field];
          } else {
            countbody += row.field[field];
          }
        });
        row.field["recipient"] = countrecipient;
        row.field["body"] = countbody;
        row.field["sender"] = countSender;
        row.field["total"] = countSender + countbody + countrecipient;
        return row;
      });
      var wordArr = [];
      var numArr = [];
      var emptyArr = [];
      data.forEach((el) => {
        if (Number(el.email.name.charAt(0))) {
          numArr.push(el);
        } else if (el.email.name != "") {
          wordArr.push(el);
        } else {
          emptyArr.push(el);
        }
      });
      wordArr.sort((a, b) => {
        return (
          !a.email.name - !b.email.name ||
          a.email.name.localeCompare(b.email.name)
        );
      });
      wordArr.sort((a, b) => b.field.total - a.field.total);
      numArr.sort((a, b) => a - b);
      emptyArr.sort((a, b) => b.field.total - a.field.total);
      let dataend = wordArr.concat(numArr);
      let sorted = dataend.concat(emptyArr);

      return [...sorted];
    };

    this.commit("example/SET_EMAILS", emails());
    this.commit("example/SET_LOADING_DNS", false);
  });

  return new Promise((resolve, reject) => {
    this.commit("example/SET_LOADING", true);
    this.commit("example/SET_LOADING_DNS", true);
    this.commit("example/SET_PERCENTAGE", 0);
    this.commit("example/SET_EMAILS", []);

    this.$axios
      .get(
        this.$api +
          `/imap/${JSON.parse(
            JSON.stringify(currentState.imap.id)
          )}/collectEmails`,
        {
          params: {
            fields: data.fields.split(","),
            boxes: data.boxes,
            folders: currentState.boxes,
            password: currentState.imap.password,
          },
        }
      )
      .then((response) => {
        this.commit("example/SET_LOADING", false);
        this.commit("example/SET_CURRENT", "");
        this.commit("example/SET_STATUS", "");
        this.commit("example/SET_INFO_MESSAGE", response.data.message);
        resolve(response);
      })
      .catch((error) => {
        this.commit(
          "example/SET_ERROR",
          JSON.parse(JSON.stringify(error.error))
        );
        reject(error);
      });
  });
}

export async function signUp({ context, state }, { data }) {
  return new Promise((resolve, reject) => {
    this.commit("example/SET_LOADING", true);
    // get imapInfo account or create one
    this.$axios
      .post(this.$api + "/imap/signup", data)
      .then((response) => {
        this.commit("example/SET_LOADING", false);
        this.commit("example/SET_PASSWORD", data.password);
        this.commit("example/SET_IMAP", response.data.imapdata);
        this.commit("example/SET_INFO_MESSAGE", response.data.message);
        resolve(response);
      })
      .catch((error) => {
        this.commit("example/SET_ERROR", error.response.data.error);
        reject(error);
        //this.commit("example/SET_ERROR", error.response.data.message);
      });
  });
}
export async function signIn({ context, state }, { data }) {
  return new Promise((resolve, reject) => {
    this.commit("example/SET_LOADING", true);
    // get imapInfo account or create one
    this.$axios
      .post(this.$api + "/imap/login", data)
      .then((response) => {
        this.commit("example/SET_LOADING", false);
        this.commit("example/SET_PASSWORD", data.password);
        this.commit("example/SET_IMAP", response.data.imap);
        this.commit("example/SET_INFO_MESSAGE", response.data.message);

        resolve(response);
      })
      .catch((error) => {
        this.commit("example/SET_ERROR", error.response.data.error);
        reject(error);
      });
  });
}
export function getBoxes({ context, getters }) {
  this.commit("example/SET_LOADINGBOX", true);
  const currentState = getters.getStates;
  this.$axios
    .get(
      this.$api +
        `/imap/${JSON.parse(JSON.stringify(currentState.imap.id))}/boxes`,
      {
        params: {
          password: currentState.imap.password,
        },
      }
    )
    .then((response) => {
      this.commit("example/SET_LOADINGBOX", false);
      this.commit("example/SET_BOXES", response.data.boxes);
      this.commit("example/SET_INFO_MESSAGE", response.data.message);
    })
    .catch((error) => {
      this.commit("example/SET_ERROR", error.response.data.error);
    });
}
