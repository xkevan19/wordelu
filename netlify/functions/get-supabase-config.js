exports.handler = async function (event, context) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY) are not set in Netlify."
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Application configuration error. Missing Supabase credentials.",
      }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: supabaseUrl,
      key: supabaseAnonKey,
    }),
  };
};
