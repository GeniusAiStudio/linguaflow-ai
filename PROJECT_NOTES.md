# Project Notes

## Current project

This is the cleaned deployment-ready copy of the web application project.

## Security review

- No Gemini API key, password, private key, service-account secret, or access token was found in the source scan.
- `.env.example` contains only an empty `GEMINI_API_KEY` placeholder.
- The Firebase client configuration contains a client API key. Keep Firebase API restrictions and authorized domains configured.
- Keep `GEMINI_API_KEY` in the deployment platform's environment variables; do not commit the real value to source code.

## Deployment checklist

1. Add `GEMINI_API_KEY` as a secret/environment variable on the hosting platform.
2. Configure Firebase authorized domains and API restrictions.
3. Install dependencies and run the production build.
4. Test authentication, Gemini-powered features, uploads, and exports after deployment.

## Cleanup

The unnecessary `migrated_prompt_history` folder was excluded from the cleaned deployment package.
