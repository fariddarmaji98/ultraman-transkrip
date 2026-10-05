' Wrapper tanpa-window untuk start-servers.cmd (dipanggil Task Scheduler).
' wscript //B //Nologo ... -> tidak ada console flash.
CreateObject("WScript.Shell").Run """D:\AI Project\ultraman-transkrip\scripts\start-servers.cmd""", 0, False
