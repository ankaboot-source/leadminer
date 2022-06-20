
class EmailServer {
    constructor(user,connectionMethod)
    connect(){}
    disconnect(){}
    refresh(){}
}
class EmailAccountMiner {
    constructor(connection, fields, cursor, batch_size){
        this.connection = connection;
        this.fields = fields;
        this.cursor = cursor || CURSOR; 
        this.body = body;
        this.batch_size = batch_size || MAX_BATCH_SIZE;
    }
    get tree(){
        // get all folders from mailbox
    }
    get treeByFolder(){
        // get infos for a given folder(INBOX eg)
    }
    get folderEmailsNumber(){

    }
    get treeToMine(){

    }
    set treeToMine(treeToMine){
        // return total to mine
    }
    refreshTree(){
        // refresh tree from imap
    }
    mine(){
        // implements a for loop to go through all folders
        // it calls this.mineFolder()
    }
    mineFolder(folder){
        // for a given folder name, mine messages
        //calls mineBatch
    }
    mineBatch(){
        // recieves two params cursor and EmailMessage object
        // after using emails = EmailMessage.extractEmailAddressesFromHeader()
        // calls helpers like isNoReply(), isNewsletter(), isInConversation() on each element in emails
        // then push to emailsArray . if emailsArray.length > batch_size then store new emails and 
        // update old ones(we will use redis to check if already mined address) in database, else
        // update emailsArray if alreadyMined(emailAddress) == true (this address already mined and we need only an update) 
    }

}  


class EmailMessage {
    constructor(sequentialId, header, body) {
      this.sequentialId = sequentialId;
      this.header = header || {};
      this.body = body || {};
    }
    isNewsletter(){

    }
    isTransactional(){

    }
    isInConversation(){

    }
    isInvitation(){

    }
    hasAttachement(){

    }
    getSenderIp(){

    }
    getDate(){

    }
    getMessageId(){

    }
    getSize(){
        
    }
    extractEmailAddressesFromHeader(){
        // uses regex helpers to extract emails addresses from header
    }
    extractEmailAddressesFromBody(){
        // uses regex helpers to extract emails addresses from body
    }
    extractPhoneContact(){

    }

    
}