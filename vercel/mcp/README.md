# ReleaseRadar MCP

Use the Streamable HTTP endpoint `https://releaseradar-lime.vercel.app/api/mcp` for reports you choose to send to ReleaseRadar. To process private JUnit XML locally, run `npm ci` in the repository’s `vercel` directory with Node 24 and configure a stdio client:

```json
{
  "mcpServers": {
    "releaseradar": {
      "command": "node",
      "args": ["/absolute/path/to/release-radar/vercel/mcp/stdio.js"]
    }
  }
}
```

Ask your assistant to read `releaseradar://examples/checkout`, compare the two reports, and investigate the missing case. The example uses synthetic reports and a sample source diff.

- **compare_runs** accepts two JUnit XML strings (up to 80,000 characters each). It matches suite path, class and test name. Counts include unchanged results. Use the returned offset for the next page.
- **investigate_missing_test** takes the same pair, the exact test identity and an optional unified diff for the revisions being compared. For JavaScript literal test declarations it can cite a removed declaration and suggest a possible rename when the corresponding candidate identity appears in the same suite and class. A changed declaration alone cannot establish a loss of behavioral coverage. Diff provenance is caller-supplied.
- **compare_latest_actions** is available in local stdio when the host provides `RR_GITHUB_ACTIONS_TOKEN` with Actions read access to `kallurayaankit/release-radar`. It reads the two latest completed main push runs of `vercel.yml`. Run links accompany the comparison. Configure the token in the host environment, outside prompts and tool arguments.

- **trace_test_history** takes up to 12 reports, oldest first, and returns the last supplied run containing the test, its outcome in each run and the number of trailing reports where it was absent. The hosted request size limit is 250,000 bytes.

Run `node --test tests/mcp.test.mjs` from `vercel` for the protocol smoke test and synthetic investigation cases.
