# Mentra App Debugging Guide

## How to View Logs and Debug Your Mentra App

### 1. Accessing Logs in MentraOS Phone App

Your app uses `session.logger` which is the correct way to log in Mentra apps. To view these logs:

1. **Open the MentraOS Phone App**
2. **Navigate to your running app**
3. **Look for logs/debug section** in the app interface
4. **All your `session.logger` messages will appear there**

### 2. Log Levels Used in This App

- `session.logger.info()` - General information and flow tracking
- `session.logger.error()` - Errors with structured data
- `session.logger.debug()` - Detailed debugging information

### 3. Key Debugging Points

#### Startup Issues

Look for these log messages when the app starts:

- `🚀 New session started` - Session initialization
- `📱 App version` - Version info
- `🔧 Environment` - Environment details
- `🏥 Performing startup health check` - Health check status
- `✅ All required environment variables present` - Environment validation

#### Display Issues

Look for these log messages for UI problems:

- `📺 Displaying main menu` - Menu display attempts
- `✅ Main menu displayed successfully` - Successful display
- `❌ Failed to show main menu` - Display failures
- `🔄 Attempting fallback display` - Fallback attempts

#### Common Error Patterns

- `❌ Session setup failed` - Session initialization problems
- `💥 Failed to display error message` - Critical display failures
- `❌ Missing required environment variables` - Configuration issues

### 4. Troubleshooting Steps

#### App Not Starting

1. Check for `🏥 Health check` messages
2. Verify environment variables are set:
   - `OPENAI_API_KEY`
   - `MENTRAOS_API_KEY`
3. Look for startup error messages

#### App Crashes Immediately

1. Look for `❌ Session setup failed` messages
2. Check the error details and stack traces
3. Verify all dependencies are installed (`npm install`)

#### Nothing Shows on Display

1. Look for `📺 Displaying main menu` messages
2. Check for display error messages
3. Verify the app is actually running (check session logs)

#### Transcription Not Working

1. Look for `Processing transcript` messages
2. Check sensor data reception logs
3. Verify lecture mode is active

### 5. Important: Restart After Changes

**Always restart your app in the MentraOS phone app after:**

- Making code changes
- Restarting your development server
- Changing environment variables

### 6. Enhanced Error Information

The app now provides structured error logging with:

- Error messages
- Stack traces
- Context information (sessionId, userId)
- Timestamp information

### 7. Debug Mode Tips

To get more detailed logs:

1. Set `NODE_ENV=development` in your environment
2. Look for `session.logger.debug()` messages
3. Check the health check output on startup

### 8. Common Issues and Solutions

#### "Nothing shows up in log"

- Ensure you're looking in the correct section of the MentraOS phone app
- Verify the app is actually connecting (look for session start messages)
- Try restarting the app in the phone app

#### App appears to work locally but not in Mentra

- Check that all environment variables are available in the Mentra environment
- Verify the API keys are correctly set
- Look for network-related errors in the logs

#### Transcription not being processed

- Check for `🎓 Lecture Mode Active` display message
- Look for `Processing transcript` log messages
- Verify sensor data is being received

### 9. Getting Help

If you're still having issues:

1. Capture the full log output from the MentraOS phone app
2. Note the exact sequence of actions that led to the problem
3. Check if the issue occurs consistently or intermittently
4. Include any error messages with stack traces

### 10. Development vs Production Logging

- **Development**: More verbose logging with debug messages
- **Production**: Essential logging only (info, warn, error)
- Use the environment variable to control log levels
