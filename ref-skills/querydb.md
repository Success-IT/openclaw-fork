---
allowed-tools: Bash(sqlcmd:*)
argument-hint: <query> [connection-details]
description: Query SQL Server databases using sqlcmd with proper connection handling
---

# Query Database Command

You are tasked with querying a SQL Server database using sqlcmd. This command handles connection setup, special character escaping, and query execution.

## Arguments

**Input**: $ARGUMENTS

The user may provide:

- A SQL query to run
- Connection details (server, database, username, password)
- Or reference previously provided credentials

## Prerequisites

sqlcmd is installed via Homebrew at `/opt/homebrew/opt/mssql-tools18/bin/sqlcmd` and is available in PATH as just `sqlcmd`.

## Connection Syntax

```bash
sqlcmd -S '<server\instance,port>' -d <database> -U <username> -P $'<password>' -C -Q "<query>"
```

### Important Flags

| Flag | Description                                                                          |
| ---- | ------------------------------------------------------------------------------------ |
| `-S` | Server address with instance and port (e.g., `'52.237.81.118\sqlprodexpress,53048'`) |
| `-d` | Database name                                                                        |
| `-U` | Username                                                                             |
| `-P` | Password (use `$'...'` syntax for special characters)                                |
| `-C` | Trust server certificate (required for most connections)                             |
| `-Q` | Run query and exit                                                                   |
| `-W` | Remove trailing spaces from output                                                   |

## Password Handling (CRITICAL)

Passwords with special characters (`$`, `!`, `@`, `*`, etc.) **MUST** use the `$'...'` quoting syntax:

```bash
# WRONG - shell interprets $ characters
sqlcmd -P 'Pass$123$word!'

# CORRECT - $'...' prevents shell interpretation
sqlcmd -P $'Pass$123$word!'
```

## Example Connections

### Standard Connection

```bash
sqlcmd -S '52.237.81.118\sqlprodexpress,53048' -d insJKInsurance_GIPrd -U saProd -P $'TmXyGc6&vn*2Fh%zJxzktEDi62mMNf' -C -Q "SELECT TOP 10 * FROM tblCustomer"
```

### List All Tables

```bash
sqlcmd -S '<server>' -d <database> -U <user> -P $'<password>' -C -Q "SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME"
```

### Test Connection

```bash
sqlcmd -S '<server>' -d <database> -U <user> -P $'<password>' -C -Q "SELECT 1 AS ConnectionTest"
```

### Describe Table Structure

```bash
sqlcmd -S '<server>' -d <database> -U <user> -P $'<password>' -C -Q "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '<table_name>' ORDER BY ORDINAL_POSITION"
```

## Workflow

### Step 1: Get Connection Details

If connection details are not provided, ask the user:

> "Please provide the database connection details:
>
> - Server (e.g., `52.237.81.118\sqlprodexpress,53048`)
> - Database name
> - Username
> - Password"

### Step 2: Test Connection

Always test the connection first:

```bash
sqlcmd -S '<server>' -d <database> -U <user> -P $'<password>' -C -Q "SELECT 1 AS ConnectionTest"
```

**If connection fails**:

- Check if password has special characters (use `$'...'` syntax)
- Verify server address includes instance name and port if needed
- Check firewall rules (may need to add IP via Azure CLI)

### Step 3: Execute Query

Run the user's query:

```bash
sqlcmd -S '<server>' -d <database> -U <user> -P $'<password>' -C -W -Q "<user-query>"
```

### Step 4: Present Results

Format the results clearly. For large result sets, suggest:

- Adding `TOP N` to limit rows
- Selecting specific columns instead of `*`
- Exporting to file with `-o output.txt`

## Azure SQL Firewall Setup

If connecting to Azure SQL and getting connection timeout:

1. Get your public IP:

```bash
curl -s ifconfig.me
```

2. Add firewall rule:

```bash
az sql server firewall-rule create \
  --resource-group <resource-group> \
  --server <server-name> \
  --name <rule-name> \
  --start-ip-address <your-ip> \
  --end-ip-address <your-ip>
```

3. Find server's resource group:

```bash
az sql server list --query "[?contains(name, '<server-name>')].{name:name, resourceGroup:resourceGroup}" -o table
```

## Common Queries

| Task            | Query                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| List tables     | `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`                   |
| Count rows      | `SELECT COUNT(*) FROM <table>`                                                                       |
| Table structure | `SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '<table>'`                              |
| Find column     | `SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME LIKE '%<search>%'` |
| Database size   | `EXEC sp_spaceused`                                                                                  |

## Error Handling

| Error              | Solution                                                   |
| ------------------ | ---------------------------------------------------------- |
| Login failed       | Check username/password, use `$'...'` for special chars    |
| Timeout            | Check server address, firewall rules, network connectivity |
| Certificate error  | Add `-C` flag to trust server certificate                  |
| Database not found | Verify database name with `SELECT name FROM sys.databases` |

## Output Options

- `-o <file>` - Save output to file
- `-s ","` - Use comma as column separator (for CSV)
- `-W` - Remove trailing spaces
- `-h -1` - Hide column headers
