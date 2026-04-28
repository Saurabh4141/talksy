const db = require("../../config/db");
const crypto = require("crypto");
const { generateToken } = require("../../utils/jwt");
// OTP generator
const generateOtp = () => {
  return crypto.randomInt(1000, 10000).toString();
};

const requestOtp = async ({ phone, ip }) => {
  try {
    // 1. Validation
    if (!phone || !/^\d{10}$/.test(phone)) {
      throw new Error("Invalid phone number");
    }

    // 2. Rate limiting (max 3 requests per minute)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    const { data: recentRequests, error: rateError } = await db
      .from("otp_requests")
      .select("id")
      .eq("phone", phone)
      .gte("created_at", oneMinuteAgo);

    if (rateError) throw new Error(rateError.message);

    if (recentRequests && recentRequests.length >= 3) {
      throw new Error("Too many OTP requests. Try again later.");
    }

    // 3. Generate OTP
    const otp = generateOtp();

    // 4. Expiry (5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // 5. Insert into DB
    const { error: insertError } = await db.from("otp_requests").insert([
      {
        phone,
        otp,
        ip_address: ip,
        expires_at: expiresAt,
        is_verified: false,
      },
    ]);

    if (insertError) {
      throw new Error(insertError.message);
    }

    // 6. Return safe response
    return { sent: true };
  } catch (err) {
    throw err;
  }
};

const verifyOtp = async ({ phone, code }) => {
  try {
    console.log("🔐 verifyOtp called:", { phone, code });

    // 1. Validation
    if (!phone || !/^\d{10}$/.test(phone)) {
      console.log("❌ Invalid phone format");
      throw new Error("Invalid phone number");
    }

    if (!code || !/^\d{4}$/.test(code)) {
      console.log("❌ Invalid OTP format");
      throw new Error("Invalid OTP");
    }

    // 2. Get latest OTP
    const { data: otpData, error: fetchError } = await db
      .from("otp_requests")
      .select("*")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError) {
      console.log("❌ DB fetch error:", fetchError);
      throw new Error(fetchError.message);
    }

    console.log("📦 OTP fetched:", otpData);

    if (!otpData || otpData.length === 0) {
      console.log("❌ No OTP found for phone");
      throw new Error("Invalid or expired OTP");
    }

    const otpRecord = otpData[0];
    const attempts = otpRecord.attempts || 0;

    console.log("📊 OTP record:", otpRecord);

    // 3. Already used
    if (otpRecord.is_verified) {
      console.log("❌ OTP already used");
      throw new Error("OTP already used");
    }

    // 4. Attempt limit
    if (attempts >= 5) {
      console.log("❌ Too many attempts:", attempts);
      throw new Error("Too many attempts. Please request a new OTP");
    }

    // 5. Check code
    if (otpRecord.otp !== code) {
      console.log("❌ Incorrect OTP entered", {
        entered: code,
        actual: otpRecord.otp,
      });

      await db
        .from("otp_requests")
        .update({ attempts: attempts + 1 })
        .eq("id", otpRecord.id);

      throw new Error("Incorrect OTP");
    }

    console.log("✅ OTP matched");

    // 6. Check expiry
    const now = new Date();
    const expiry = new Date(otpRecord.expires_at);

    console.log("⏰ Time check:", {
      now: now.toISOString(),
      expiry: expiry.toISOString(),
    });

    if (expiry < now) {
      console.log("❌ OTP expired");
      throw new Error("OTP expired");
    }

    console.log("✅ OTP not expired");

    // 7. Mark OTP as used
    const { error: updateError } = await db
      .from("otp_requests")
      .update({ is_verified: true })
      .eq("id", otpRecord.id);

    if (updateError) {
      console.log("❌ Failed to mark OTP used:", updateError);
      throw new Error(updateError.message);
    }

    console.log("✅ OTP marked as used");

    // 8. Check user
    const { data: existingUser, error: userError } = await db
      .from("users")
      .select("*")
      .eq("phone", phone)
      .limit(1);

    if (userError) {
      console.log("❌ User fetch error:", userError);
      throw new Error(userError.message);
    }

    let user;
    let isExistingUser = false;
    let onboardingCompleted = false;

    if (existingUser && existingUser.length > 0) {
      console.log("👤 Existing user found");

      user = existingUser[0];
      isExistingUser = true;
      onboardingCompleted = !!user.name;
    } else {
      console.log("🆕 Creating new user");

      const { data: newUser, error: createError } = await db
        .from("users")
        .insert([
          {
            phone,
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      if (createError) {
        console.log("❌ User creation failed:", createError);
        throw new Error(createError.message);
      }

      user = newUser[0];
    }

    // 9. Token
    const token = generateToken({
      userId: user.id,
      phone: user.phone,
    });

    console.log("🎉 verifyOtp success", {
      userId: user.id,
      isExistingUser,
      onboardingCompleted,
    });

    // 10. Final response
    return {
      token,
      user,
      isExistingUser,
      onboardingCompleted,
    };
  } catch (err) {
    console.log("🔥 verifyOtp error:", err.message);
    throw err;
  }
};

const saveOnboarding = async ({ userId, payload }) => {
  try {
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const {
      name,
      userGender,
      intent,
      language,
      vibe,
      companionName,
      companionGender,
      companionType,
      personality,
      role,
    } = payload;

    // ✅ basic validation
    if (!name || !companionName) {
      throw new Error("Missing required fields");
    }

    const { data, error } = await db
      .from("users")
      .update({
        name,
        user_gender: userGender,
        intent,
        language,
        vibe,

        companion_name: companionName,
        companion_gender: companionGender,
        companion_type: companionType,
        personality,
        role,

        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select();

    if (error) throw new Error(error.message);

    return {
      saved: true,
      user: data[0],
    };
  } catch (err) {
    throw err;
  }
};

module.exports = {
  requestOtp,
  verifyOtp,
  saveOnboarding
};
