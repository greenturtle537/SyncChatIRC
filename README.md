# SyncChatIRC
This is a modular javascript program for the Syncterm BBS which bridges an external IRC to local node chat.

SyncChatIRC is a sister program of [SyncChatIRC (Developed by Tartarus6)](https://github.com/Tartarus6/SyncChatIRC) and should not be confused for it, although they are named the same.

### Features
- Chat messages in Syncterm Multinode Chat show up in IRC, and vice versa
- Action messages from Multinode appear over IRC
- Join and leave messages from Multinode appear over IRC

### Commands
- `exec ?ircbridge` - Connects your specified IRC server to the specified multinode chat room.

### Configuration
Configuration information is included at the top of the JavaScript file. This is designed to be as portable as possible.

### Installation
To add SyncChatIRC to your Synchronet BBS, simply download the ircbridge.js file and place it in your sbbs/exec directory. You can execute it from sysop commands or you can set it to autorun.
