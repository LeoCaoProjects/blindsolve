# Security

Report suspected vulnerabilities privately to the repository owner at leocao225@gmail.com. Include the affected version and a minimal description. Keep credentials, real account data and private reports out of public issues.

- Only public Supabase client configuration belongs in `VITE_` variables. Keep service-role keys and OAuth secrets in the server or Edge function environment.
- Use disposable local services and synthetic data when verifying account, RPC, storage and recovery behavior. Verify the network and destinations before sending requests.
- Treat backups and legacy review exports as private user data. Review exports are for the signed-in owner and are separate from workspace imports.
- Verify effective headers and grants, provider settings, Edge upload ceilings and dependency advisories before release.
