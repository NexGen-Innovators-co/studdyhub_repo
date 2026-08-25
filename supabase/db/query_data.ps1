# Query real DATA values (not schema) via the Management API SQL endpoint.
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class CredQ {
    [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);
    [DllImport("advapi32.dll", SetLastError=true)]
    public static extern bool CredFree(IntPtr cred);
    [StructLayout(LayoutKind.Sequential)]
    public struct CREDENTIAL {
        public int Flags; public int Type; public IntPtr TargetName; public IntPtr Comment;
        public long LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob;
        public int Persist; public int AttributeCount; public IntPtr Attributes; public IntPtr TargetAlias; public IntPtr UserName;
    }
}
"@
function Get-CredBlob([string]$target) {
    $ptr = [IntPtr]::Zero
    if ([CredQ]::CredRead($target, 1, 0, [ref]$ptr)) {
        try {
            $cred = [System.Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][CredQ+CREDENTIAL])
            $size = $cred.CredentialBlobSize
            if ($size -gt 0) {
                $blob = New-Object byte[] $size
                [System.Runtime.InteropServices.Marshal]::Copy($cred.CredentialBlob, $blob, 0, $size)
                $utf8 = [System.Text.Encoding]::UTF8.GetString($blob)
                if ($utf8 -match '^sbp_') { return $utf8.TrimEnd([char]0) }
                return $utf8.TrimEnd([char]0)
            }
        } finally { [CredQ]::CredFree($ptr) | Out-Null }
    }
    return $null
}
$token = Get-CredBlob "Supabase CLI:supabase"
if (-not $token) { Write-Output "NO_TOKEN"; exit 1 }
$base = "https://api.supabase.com/v1/projects/vykidardmwtxwjtijjap/database/query"

function Run-Sql([string]$label, [string]$sql) {
    $body = @{ query = $sql } | ConvertTo-Json -Compress
    try {
        $resp = Invoke-RestMethod -Uri $base -Method Post -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" } -Body $body -TimeoutSec 60
        Write-Output "=== $label ==="
        $resp | ConvertTo-Json -Depth 5
    } catch {
        Write-Output "=== $label FAILED: $($_.Exception.Message) ==="
    }
}

Run-Sql "distinct plan_type" "SELECT plan_type, status, count(*) FROM public.subscriptions GROUP BY plan_type, status ORDER BY plan_type"
Run-Sql "subscription rows sample" "SELECT user_id, plan_type, status FROM public.subscriptions LIMIT 5"
Write-Output "QUERY_DATA_DONE"
