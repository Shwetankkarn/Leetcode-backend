
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

// Build a Java main() wrapper for Two Sum and Valid Parentheses.
const wrapJavaCode = (code, input) => {
  // Complete Java programs can execute directly.
  if (/public\s+static\s+void\s+main\s*\(/.test(code)) {
    return code;
  }

  const escapedInput = JSON.stringify(String(input ?? ""));
  let mainCode;

  if (/\btwoSum\s*\(/.test(code)) {
    mainCode = `
        String rawInput = ${escapedInput};

        java.util.regex.Matcher matcher =
            java.util.regex.Pattern.compile("-?\\\\d+").matcher(rawInput);

        java.util.List<Integer> values = new java.util.ArrayList<>();

        while (matcher.find()) {
            values.add(Integer.parseInt(matcher.group()));
        }

        if (values.size() < 3) {
            throw new IllegalArgumentException(
                "Two Sum input must contain array values and a target."
            );
        }

        int target = values.get(values.size() - 1);
        int[] nums = new int[values.size() - 1];

        for (int i = 0; i < nums.length; i++) {
            nums[i] = values.get(i);
        }

        Solution solution = new Solution();
        int[] result = solution.twoSum(nums, target);

        for (int i = 0; i < result.length; i++) {
            if (i > 0) System.out.print(" ");
            System.out.print(result[i]);
        }
    `;
  } else if (/\bisValid\s*\(/.test(code)) {
    mainCode = `
        String s = ${escapedInput};

        Solution solution = new Solution();
        System.out.print(solution.isValid(s));
    `;
  } else {
    throw new Error(
      "Unsupported Java solution. Expected twoSum() or isValid()."
    );
  }

  return `
import java.util.*;

${code}

public class Main {
    public static void main(String[] args) {
        ${mainCode}
    }
}
`;
};

const executeCode = async (code, language, input) => {
  const languageConfig = getLanguageById(language);

  if (!languageConfig) {
    throw new Error("Unsupported language: " + language);
  }

  if (
    !process.env.JDOODLE_CLIENT_ID ||
    !process.env.JDOODLE_CLIENT_SECRET
  ) {
    throw new Error("JDoodle credentials are missing.");
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

const normalizeOutput = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ");

const submitBatch = async (submissions) => {
  if (!Array.isArray(submissions) || submissions.length === 0) {
    return [];
  }

  return Promise.all(
    submissions.map(async (submission, index) => {
      console.log(`--- Test Case ${index + 1} ---`);
      console.log("Input:", JSON.stringify(submission.stdin));
      console.log(
        "Expected:",
        JSON.stringify(submission.expected_output)
      );

      const result = await executeCode(
        submission.source_code,
        submission.language,
        submission.stdin
      );

      const output = normalizeOutput(result.output);
      const expected = normalizeOutput(submission.expected_output);

      console.log("Actual:", JSON.stringify(output));
      console.log("Match:", output === expected);

      let statusId = 3;
      let errorMessage = result.error || null;

      if (result.error) {
        statusId = 6;
      } else if (output !== expected) {
        statusId = 4;
      }

      return {
        stdout: result.output ?? "",
        stderr: errorMessage,
        compile_output: errorMessage,
        status_id: statusId,
        time: result.cpuTime ?? "0",
        memory: result.memory ?? 0,
        message: errorMessage,
      };
    })
  );
};

// JDoodle returns execution results directly.
const submitToken = async (results) => results;

module.exports = {
  getLanguageById,
  submitBatch,
  submitToken,
};
