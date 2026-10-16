
const axios = require("axios");
require("dotenv").config();

const getLanguageById = (lang) => {
  if (typeof lang !== "string" || !lang.trim()) {
    return null;
  }

  const languages = {
    "c++": { language: "cpp17", versionIndex: "0" },
    cpp: { language: "cpp17", versionIndex: "0" },
    java: { language: "java", versionIndex: "4" },
    javascript: { language: "nodejs", versionIndex: "4" },
  };

  return languages[lang.trim().toLowerCase()] || null;
};

// Wrapper for the current Valid Parentheses problem.
// JDoodle needs a Java main() method to execute the Solution class.
const wrapJavaCode = (code, input) => {
  // If the user submitted a complete Java program, use it as-is.
  if (/public\s+static\s+void\s+main\s*\(/.test(code)) {
    return code;
  }

  const escapedInput = JSON.stringify(input ?? "");

  return `
import java.util.*;

${code}

public class Main {
    public static void main(String[] args) {
        String s = ${escapedInput};
        Solution solution = new Solution();
        System.out.print(solution.isValid(s));
    }
}
`;
};

const executeCode = async (code, language, input) => {
  const languageConfig = getLanguageById(language);

  if (!languageConfig) {
    throw new Error(`Unsupported language: ${language}`);
  }

  if (
    !process.env.JDOODLE_CLIENT_ID ||
    !process.env.JDOODLE_CLIENT_SECRET
  ) {
    throw new Error("JDoodle credentials are missing from .env");
  }

  const script =
    languageConfig.language === "java"
      ? wrapJavaCode(code, input)
      : code;

  console.log("JDoodle: sending request...");
  console.log("Language:", languageConfig.language);
  console.log("Input:", JSON.stringify(input ?? ""));

  try {
    const response = await axios.post(
      "https://api.jdoodle.com/v1/execute",
      {
        clientId: process.env.JDOODLE_CLIENT_ID,
        clientSecret: process.env.JDOODLE_CLIENT_SECRET,
        script,
        stdin: "",
        language: languageConfig.language,
        versionIndex: languageConfig.versionIndex,
      },
      { timeout: 15000 }
    );

    console.log("JDoodle: response received");
    console.log("JDoodle status:", response.status);
    console.log("JDoodle output:", response.data.output);
    console.log("JDoodle error:", response.data.error);

    return response.data;
  } catch (error) {
    console.error(
      "JDoodle request failed:",
      error.response?.status,
      error.response?.data || error.message
    );

    throw error;
  }
};


const submitBatch = async (submissions) => {
  if (!Array.isArray(submissions) || submissions.length === 0) {
    return [];
  }

  return Promise.all(
    submissions.map(async (submission, index) => {
      console.log(`\n--- Test Case ${index + 1} ---`);
      console.log("Input:", JSON.stringify(submission.stdin));
      console.log("Expected:", JSON.stringify(submission.expected_output));

      const result = await executeCode(
        submission.source_code,
        submission.language,
        submission.stdin
      );

      const output = String(result.output ?? "").trim();
      const expected = String(submission.expected_output ?? "").trim();

      console.log("Actual:", JSON.stringify(output));
      console.log("Match:", output === expected);

      let statusId = 3;

      if (result.error || (result.statusCode && result.statusCode !== 200)) {
        statusId = 6;
      } else if (output !== expected) {
        statusId = 4;
      }

      return {
        stdout: result.output ?? "",
        stderr: result.error ?? null,
        compile_output: result.error ?? null,
        status_id: statusId,
        time: result.cpuTime ?? "0",
        memory: result.memory ?? 0,
        message: result.error ?? null,
      };
    })
  );
};


// JDoodle returns results directly; no Judge0 token polling is needed.
const submitToken = async (results) => results;

module.exports = {
  getLanguageById,
  submitBatch,
  submitToken,
};
