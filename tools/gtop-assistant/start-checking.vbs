Option Explicit
Dim args, shell, environment, command, runResult
Set args = WScript.Arguments
If args.Count < 5 Or args.Count > 6 Then WScript.Quit 64

Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = args(4)
Set environment = shell.Environment("PROCESS")
environment("TEMP") = args(4)
environment("TMP") = args(4)
environment("TMPDIR") = args(4)
If args.Count = 6 Then
  If args(5) <> "codex-cli" And args(5) <> "openai-api" Then WScript.Quit 64
  environment("GTOP_CHECKING_ENGINE") = args(5)
End If

command = Quote(args(0)) & " --import " & Quote(args(1)) & " " & Quote(args(2)) & " " & Quote(args(3)) & " " & Quote(args(4))
runResult = shell.Run(command, 0, True)
WScript.Quit runResult

Function Quote(value)
  Quote = Chr(34) & value & Chr(34)
End Function
