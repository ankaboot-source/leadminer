function upsertMessage(
  supabaseClient,
  messageID,
  userID,
  channel,
  folder,
  date
) {
  return supabaseClient.from('messages').upsert({
    messageid: messageID,
    userid: userID,
    channel: channel,
    folder: folder,
    date: date,
    listid: '',
    reference: ''
  });
}

function upsertPointOfContact(supabaseClient, messageID, userID, name, key) {
  return supabaseClient.from('pointsofcontact').upsert({
    messageid: messageID,
    userid: userID,
    name: name,
    torecipient: key == 'to',
    ccrecipient: key == 'cc',
    bccrecipient: key == 'bcc',
    sender: key == 'from' || key == 'reply-to',
    recipient: key == 'to' || key == 'cc' || key == 'bcc'
  });
}
function upsertPersons(supabaseClient, name, emailsAddress, pointofcontact_id) {
  return supabaseClient.from('persons').upsert({
    name: name,
    email: emailsAddress,
    pointofcontact: pointofcontact_id,
    url: '',
    image: '',
    address: '',
    alternatenames: [],
    sameas: [],
    givenname: name,
    familyname: '',
    jobtitle: '',
    worksfor: 'flyweight'
  });
}

module.exports = {
  upsertMessage,
  upsertPointOfContact,
  upsertPersons
};
