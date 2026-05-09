// Load environment variables first
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

console.log('✅ .env loaded from:', path.join(__dirname, '../.env'));
console.log('✅ MONGODB_URI exists:', !!process.env.MONGODB_URI);

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const DiscordStrategy = require('passport-discord').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');

// JWT Strategy for API authentication
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

// Validate required environment variables
if (!process.env.GOOGLE_CLIENT_ID) {
  console.error('ERROR: GOOGLE_CLIENT_ID is not defined in .env');
}
if (!process.env.DISCORD_CLIENT_ID) {
  console.error('ERROR: DISCORD_CLIENT_ID is not defined in .env');
}
if (!process.env.GITHUB_CLIENT_ID) {
  console.error('ERROR: GITHUB_CLIENT_ID is not defined in .env');
}
if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET is not defined in .env');
}

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    scope: ['profile', 'email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists
      let user = await User.findOne({ 
        $or: [
          { googleId: profile.id },
          { email: profile.emails[0].value }
        ]
      });

      if (user) {
        // Update Google ID if user exists by email but no Google ID
        if (!user.googleId) {
          user.googleId = profile.id;
          user.authMethod = 'google';
          await user.save();
        }
        return done(null, user);
      }

      // Create new user
      user = await User.create({
        googleId: profile.id,
        username: profile.displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000),
        email: profile.emails[0].value,
        avatar: profile.photos[0]?.value,
        avatarUrl: profile.photos[0]?.value,
        authMethod: 'google',
        password: undefined // Not needed for OAuth users
      });

      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }));
} else {
  console.warn('Google OAuth strategy skipped - GOOGLE_CLIENT_ID not defined');
}

// Discord OAuth Strategy
if (process.env.DISCORD_CLIENT_ID) {
  passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify', 'email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists
      let user = await User.findOne({ 
        $or: [
          { discordId: profile.id },
          { email: profile.email }
        ]
      });

      if (user) {
        // Update Discord ID if user exists by email but no Discord ID
        if (!user.discordId) {
          user.discordId = profile.id;
          user.authMethod = 'discord';
          await user.save();
        }
        return done(null, user);
      }

      // Create new user
      user = await User.create({
        discordId: profile.id,
        username: profile.username + Math.floor(Math.random() * 1000),
        email: profile.email,
        avatar: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`,
        avatarUrl: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`,
        authMethod: 'discord',
        password: undefined // Not needed for OAuth users
      });

      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }));
} else {
  console.warn('Discord OAuth strategy skipped - DISCORD_CLIENT_ID not defined');
}

// GitHub OAuth Strategy
if (process.env.GITHUB_CLIENT_ID) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL,
    scope: ['user:email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Get primary email from GitHub profile
      const email = profile.emails && profile.emails.length > 0 
        ? profile.emails.find(email => email.primary).email 
        : profile.username + '@github.local'; // Fallback if no email

      // Check if user already exists
      let user = await User.findOne({ 
        $or: [
          { githubId: profile.id },
          { email: email }
        ]
      });

      if (user) {
        // Update GitHub ID if user exists by email but no GitHub ID
        if (!user.githubId) {
          user.githubId = profile.id;
          user.authMethod = 'github';
          await user.save();
        }
        return done(null, user);
      }

      // Create new user
      user = await User.create({
        githubId: profile.id,
        username: profile.username,
        email: email,
        avatar: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
        avatarUrl: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
        authMethod: 'github',
        password: undefined // Not needed for OAuth users
      });

      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }));
} else {
  console.warn('GitHub OAuth strategy skipped - GITHUB_CLIENT_ID not defined');
}

// JWT Strategy for API routes
if (process.env.JWT_SECRET) {
  passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
  }, async (payload, done) => {
    try {
      const user = await User.findById(payload.id);
      if (user) {
        return done(null, user);
      }
      return done(null, false);
    } catch (error) {
      done(error, null);
    }
  }));
} else {
  console.warn('JWT Strategy skipped - JWT_SECRET not defined');
}

// Serialize and deserialize users (for sessions)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
