// Suggestions and bug reports from the Suggestions page.
// Emailed to the developer through Web3Forms. Its free plan only accepts browser requests, so the page itself
// sends them; this module only hands over the settings. The access key can only send mail to the developer's
// inbox, so it is safe to ship. Without a key the page falls back to a prefilled GitHub issue.

// Free key from https://web3forms.com (form "Spectre Suggestions").
const WEB3FORMS_KEY = 'd34fbddf-d3b3-45be-b12e-5df89329c4eb';

module.exports = ({ handle, app }) => {
    handle('feedback:config', () => ({ key: WEB3FORMS_KEY || null, repo: 'booomxd/spectre', version: app.getVersion() }));
};
