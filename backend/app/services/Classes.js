
class EmailServer {
    constructor(user,connectionMethod)
    connect(){}
    disconnect(){}
    refresh(){}
}
class EmailAccount {
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
    }
    mineBatch(){
        
    }
}  


class EmailMessage {
    constructor(id,header , body) {
      this.id = id;
      this.header = header || "";
      this.body = body || ""
    }
    get id(){
    }
}