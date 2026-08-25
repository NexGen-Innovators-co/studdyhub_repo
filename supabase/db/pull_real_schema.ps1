# Pull the REAL schema/functions/triggers/policies from the remote Supabase project
# using the CLI's stored Management API token (Windows Credential Manager).
# Token is never printed; only a 10-char prefix is shown for confirmation.

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class CredMan {
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
    if ([CredMan]::CredRead($target, 1, 0, [ref]$ptr)) {
        try {
            $cred = [System.Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][CredMan+CREDENTIAL])
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
            [CredMan]::CredFree($ptr) | Out-Null
        }
    }
    return $null
}

$token = Get-CredBlob "Supabase CLI:supabase"
if (-not $token) {
    Write-Output "NO_TOKEN_FOUND"
    exit 1
}
Write-Output ("TOKEN_OK prefix=" + $token.Substring(0, [Math]::Min(10, $token.Length)) + " len=" + $token.Length)

$ref = "vykidardmwtxwjtijjap"
$base = "https://api.supabase.com/v1/projects/$ref/database/query"
$outDir = "C:/Users/USER/Desktop/studdyhub-ai/studdyhub-ai-mobile/supabase/db"

$queries = [ordered]@{
    "tables"    = "SELECT table_name, column_name, data_type, is_nullable, column_default, ordinal_position FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position"
    "functions" = "SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args, pg_get_function_result(p.oid) AS returns, p.prokind FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname"
    "triggers"  = "SELECT tg.tgname AS name, c.relname AS table_name, pg_get_triggerdef(tg.oid) AS definition FROM pg_trigger tg JOIN pg_class c ON c.oid=tg.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT tg.tgisinternal ORDER BY c.relname, tg.tgname"
    "policies"  = "SELECT pol.polname AS name, c.relname AS table_name, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr, pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check, pol.polpermissive, array_to_string(pol.polroles, ',') AS roles FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname, pol.polname"
    "enums"     = "SELECT t.typname AS name, e.enumlabel AS label FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname, e.enumsortorder"
    "views"     = "SELECT table_name FROM information_schema.views WHERE table_schema='public' ORDER BY table_name"
    "rlstables" = "SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname"
    "indexes"   = "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname"
    "pks"       = "SELECT tc.table_name, kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' ORDER BY tc.table_name, kcu.ordinal_position"
    "fks"       = "SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' ORDER BY tc.table_name, kcu.ordinal_position"
    "coltypes"  = "SELECT c.relname AS table_name, a.attname AS column_name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type, a.attnum FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped ORDER BY c.relname, a.attnum"
}

foreach ($name in $queries.Keys) {
    $body = @{ query = $queries[$name] } | ConvertTo-Json -Compress
    try {
        $resp = Invoke-RestMethod -Uri $base -Method Post -Headers @{
            "Authorization" = "Bearer $token"
            "Content-Type"  = "application/json"
        } -Body $body -TimeoutSec 120
        $out = "$outDir/real_$name.json"
        ($resp | ConvertTo-Json -Depth 10) | Set-Content -Path $out -Encoding UTF8
        $count = @($resp).Count
        Write-Output ("OK  $name -> $count rows")
    } catch {
        Write-Output ("FAIL $name : " + $_.Exception.Message)
        if ($_.ErrorDetails.Message) { Write-Output ("     " + $_.ErrorDetails.Message.Substring(0, [Math]::Min(300, $_.ErrorDetails.Message.Length))) }
    }
}
Write-Output "PULL_DONE"
