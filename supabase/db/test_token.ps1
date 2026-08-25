# Step 1: verify we can read the CLI token AND call the Management API.
# Prints only a short prefix of the token, never the full value.
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class CredT {
    [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);
    [DllImport("advapi32.dll", SetLastError=true)]
    public static extern bool CredFree(IntPtr cred);
    [StructLayout(LayoutKind.Sequential)]
    public struct CREDENTIAL {
        public int Flags;
        public int Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public long LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }
}
"@

function Get-CredBlob([string]$target) {
    $ptr = [IntPtr]::Zero
    if ([CredT]::CredRead($target, 1, 0, [ref]$ptr)) {
        try {
            $cred = [System.Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][CredT+CREDENTIAL])
            $size = $cred.CredentialBlobSize
            if ($size -gt 0) {
                $blob = New-Object byte[] $size
                [System.Runtime.InteropServices.Marshal]::Copy($cred.CredentialBlob, $blob, 0, $size)
                # Go keyring (used by Supabase CLI) stores the secret as raw UTF-8/ASCII bytes
                $utf8 = [System.Text.Encoding]::UTF8.GetString($blob)
                if ($utf8 -match '^sbp_') { return $utf8.TrimEnd([char]0) }
                $uni = [System.Text.Encoding]::Unicode.GetString($blob)
                if ($uni -match '^sbp_') { return $uni.TrimEnd([char]0) }
                return $utf8.TrimEnd([char]0)
            }
        } finally {
            [CredT]::CredFree($ptr) | Out-Null
        }
    }
    return $null
}

$token = Get-CredBlob "Supabase CLI:supabase"
if (-not $token) { Write-Output "NO_TOKEN_FOUND"; exit 1 }
Write-Output ("TOKEN_OK prefix=" + $token.Substring(0, [Math]::Min(8, $token.Length)) + " len=" + $token.Length)

# Try Management API: list projects (cheap check)
try {
    $resp = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects" -Method Get -Headers @{
        "Authorization" = "Bearer $token"
    } -TimeoutSec 30
    $refs = @($resp | ForEach-Object { $_.id })
    Write-Output ("API_OK projects=" + ($refs -join ","))
} catch {
    Write-Output ("API_FAIL " + $_.Exception.Message)
    if ($_.ErrorDetails.Message) { Write-Output ("  " + $_.ErrorDetails.Message.Substring(0, [Math]::Min(200, $_.ErrorDetails.Message.Length))) }
}
Write-Output "STEP1_DONE"
