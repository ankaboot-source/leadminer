function upsertMessage(
  supabaseClient,
  messageID,
  userID,
  channel,
  folder,
  date
) {
  console.log("hello");
  return supabaseClient.from("messages").upsert({
    messageid: messageID,
    userid: userID,
    channel: channel,
    folder: folder,
    date: date,
  });
}

function upsertPointOfContact(supabaseClient, messageID, userID, name, key) {
  return supabaseClient.from("pointsofcontact").upsert({
    messageid: messageID,
    userid: userID,
    name: name,
    torecipient: key == "to",
    ccrecipient: key == "cc",
    bccrecipient: key == "bcc",
    sender: key == "from",
  });
}

module.exports = {
  upsertMessage,
  upsertPointOfContact,
};
