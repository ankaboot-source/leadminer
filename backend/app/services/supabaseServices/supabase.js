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

function upsertPointOfContact(
  supabaseClient,
  messageID,
  userID,
  personid,

  key
) {
  return supabaseClient.from('pointsofcontact').upsert({
    messageid: messageID,
    userid: userID,
    torecipient: key == 'to',
    ccrecipient: key == 'cc',
    bccrecipient: key == 'bcc',
    sender: key == 'from' || key == 'reply-to',
    _personid: personid,
    recipient: key == 'to' || key == 'cc' || key == 'bcc'
  });
}
function upsertPersons(supabaseClient, name, emailsAddress) {
  return supabaseClient.from('persons').upsert(
    {
      name: name,
      email: emailsAddress,
      url: '',
      image: '',
      address: '',
      alternatenames: [],
      sameas: [],
      givenname: name,
      familyname: '',
      jobtitle: '',
      worksfor: 'flyweight'
    },
    { onConflict: 'email' }
  );
}

function createTags(supabaseClient, tags) {
  return supabaseClient
    .from('tags')
    .upsert([...tags], { onConflict: 'personid, name' });
}
module.exports = {
  upsertMessage,
  upsertPointOfContact,
  upsertPersons,
  createTags
};
