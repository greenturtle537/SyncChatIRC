# SyncChatIRC
This is a modular javascript program for the Syncterm BBS which bridges an external IRC to local node chat.

SyncChatIRC is a sister program of [SyncChatIRC (Developed by Tartarus6)](https://github.com/Tartarus6/SyncChatIRC) and should not be confused for it, although they are named the same.

### Features
- Chat messages in Syncterm Multinode Chat show up in IRC, and vice versa
- Action messages from Multinode appear over IRC [Planned]
- Join and leave messages from Multinode appear over IRC and vice versa

### Commands
- `;exec ?ircbridge` - Run from the menu with Sysop privilege, connects your specified IRC server to the specified multinode chat room.

### Configuration
Configuration information is included at the top of the JavaScript file. This is designed to be as portable as possible.

```
const IRC_SERVER = "irc.glitchtech.top"; 
// This is the location of the IRC server you want to relay to
const IRC_PORT = 6667; 
// This is the port the socket is hosting on, does not support SSL
const NICK = "GN"; 
// This is the IRC nickname of the bridge bot (GN is short for GlitchNet BBS)
const USERNAME = "GNIRCBOT"; 
// This is the IRC username of the bridge server
const REALNAME = "GlitchNet IRC Bridge Bot"; 
// This is the IRC realname of the bridge server
const SPOOF_USER = 6; 
// This is the BBS user number that the spoof node (below) will appear as for node activity, for me it is set to a dummy user named "Glitchnet Irc Bridge"
const CHANNEL_NUM = 2; 
// This is the BBS channel the bridge will connect to, 1 is the default channel and /L will show you a whole list.
const IRC_CHANNEL = "#main";
// This is the IRC channel the bridge will connect to
const SPOOF_NODE = 13;
// This is the node the bridge will use to listen for BBS messages. I recommend locking this node from login privilegs in SCFG
const DEBUG_MODE = false;
/* 
*  This causes Debug messages to be output to the screen. 
*  When testing or making changes, it is recommended that you disable autorun (more below) and launch the program with sysop privileges.
*  This way, all of these debug messages will be visible from that window.
*  The command is `;exec ?ircbridge`
*/
```

### Installation*
To add SyncChatIRC to your Synchronet BBS, simply download the ircbridge.js file and place it in your sbbs/exec directory. You can execute it from sysop commands or you can set it to autorun.

To ensure that SyncChatIRC is always started when you restart/start your BBS server, set it to autorun using SCFG or your preferred configuration method. 

For SCFG:
1. Navigate to 'External Programs' -> 'Timed Events'
2. Create a new event named 'IRCBRIDGE'
3. Set 'Command Line' to `?ircbridge.js`
4. Set 'Always Run After (re)Init' to `Yes`
5. (OPTIONAL) Make any other configuration changes
6. Save changes and exit SCFG
7. Restart Syncterm using your preferred method. Likely `service sbbs restart` or `systemctl restart sbbs`

You can confirm this method works by having an additional window connected to your IRC server, when the system restarts, you should see the IRC bridge bot leave and rejoin, then broadcast it's presence and active users. The IRC bridge is now working on both endpoints.

If you would like to use a different configuration method, this guide assumes you have advanced knowledge of Synchronet and do not require additional assistance.