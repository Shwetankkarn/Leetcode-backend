
const Problem = require("../Models/problem");
const Submission = require("../Models/submissions");
const {
  getLanguageById,
  submitBatch,
  submitToken,
} = require("../utils/problemUtility");

const submitCode = async (req, res) => {
  let submittedResult;

  try {
    const userId = req.user?._id;
    const problemId = req.params.id;
    const { code, language } = req.body;

    console.log("Submit language:", language);

    if (!userId || !problemId || !code || !language) {
      return res.status(400).json({
        message: "Some fields are missing.",
      });
    }

    const problem = await Problem.findById(problemId);

    if (!problem) {
      return res.status(404).json({
        message: "Problem not found.",
      });
    }

    const hiddenTestCases = problem.hiddenTestCases || [];

    console.log("Hidden test cases:", hiddenTestCases.length);

    if (hiddenTestCases.length === 0) {
      return res.status(400).json({
        message: "No hidden test cases are configured for this problem.",
      });
    }

    if (!getLanguageById(language)) {
      return res.status(400).json({
        message: `Unsupported language: ${language}`,
      });
    }

    submittedResult = await Submission.create({
      userId,
      problemId,
      code,
      language,
      testCasePassed: 0,
      status: "pending",
      testCasesTotal: hiddenTestCases.length,
      runtime: 0,
      memory: 0,
      errorMessage: null,
    });

    const submissions = hiddenTestCases.map((testcase) => ({
      source_code: code,
      language,
      stdin: testcase.input,
      expected_output: testcase.output,
    }));

    const submitResult = await submitBatch(submissions);
    const testResult = await submitToken(submitResult);

    if (
      !Array.isArray(testResult) ||
      testResult.length !== hiddenTestCases.length
    ) {
      throw new Error("Incomplete execution results received.");
    }

    let passed = 0;
    let runtime = 0;
    let memory = 0;
    let status = "Accepted";
    let errorMessage = null;

    for (const test of testResult) {
      if (test.status_id === 3) {
        passed++;
        runtime += Number(test.time || 0);
        memory = Math.max(memory, Number(test.memory || 0));
      } else if (test.status_id === 6) {
        status = "Compilation Error";
        errorMessage =
          test.compile_output || test.stderr || "Compilation failed.";
        break;
      } else if (test.status_id === 5) {
        status = "Time Limit Exceeded";
        errorMessage = "Execution timed out.";
        break;
      } else if (test.status_id === 4) {
        status = "Wrong Answer";
        errorMessage = "Output did not match the expected result.";
        break;
      } else {
        status = "Runtime Error";
        errorMessage = test.stderr || test.message || "Execution failed.";
        break;
      }
    }

    submittedResult.status = status;
    submittedResult.runtime = runtime;
    submittedResult.memory = memory;
    submittedResult.errorMessage = errorMessage;
    submittedResult.testCasePassed = passed;

    await submittedResult.save();

    if (
      status === "Accepted" &&
      passed === hiddenTestCases.length &&
      !req.user.problemSolved.some(
        (id) => id.toString() === problemId
      )
    ) {
      req.user.problemSolved.push(problemId);
      await req.user.save();
    }

    return res.status(201).json(submittedResult);
  } catch (err) {
    console.error("Submit code error:", err.message);

    if (submittedResult) {
      submittedResult.status = "Runtime Error";
      submittedResult.errorMessage = err.message;

      try {
        await submittedResult.save();
      } catch (saveError) {
        console.error("Submission save error:", saveError.message);
      }
    }

    return res.status(500).json({
      message: "Code submission failed.",
      error: err.message,
    });
  }
};

const runCode = async (req, res) => {
  try {
    const problemId = req.params.id;
    const { code, language } = req.body;

    console.log("Run language:", language);

    if (!problemId || !code || !language) {
      return res.status(400).json({
        message: "Some fields are missing.",
      });
    }

    const problem = await Problem.findById(problemId);

    if (!problem) {
      return res.status(404).json({
        message: "Problem not found.",
      });
    }

    const visibleTestCases = problem.visibleTestCases || [];

    if (visibleTestCases.length === 0) {
      return res.status(400).json({
        message: "No visible test cases are configured.",
      });
    }

    if (!getLanguageById(language)) {
      return res.status(400).json({
        message: `Unsupported language: ${language}`,
      });
    }

    const submissions = visibleTestCases.map((testcase) => ({
      source_code: code,
      language,
      stdin: testcase.input,
      expected_output: testcase.output,
    }));

    const submitResult = await submitBatch(submissions);
    const testResult = await submitToken(submitResult);

    if (
      !Array.isArray(testResult) ||
      testResult.length !== visibleTestCases.length
    ) {
      throw new Error("Incomplete execution results received.");
    }

    let passed = 0;
    let runtime = 0;
    let memory = 0;
    let status = "success";
    let error = null;

    for (const test of testResult) {
      if (test.status_id === 3) {
        passed++;
        runtime += Number(test.time || 0);
        memory = Math.max(memory, Number(test.memory || 0));
      } else {
        status =
          test.status_id === 6
            ? "Compilation Error"
            : test.status_id === 5
              ? "Time Limit Exceeded"
              : test.status_id === 4
                ? "Wrong Answer"
                : "Runtime Error";

        error =
          test.compile_output ||
          test.stderr ||
          test.message ||
          "Execution failed.";
        break;
      }
    }

    return res.status(200).json({
      status,
      passed,
      total: visibleTestCases.length,
      runtime,
      memory,
      error,
      results: testResult,
    });
  } catch (err) {
    console.error("Run code error:", err.message);

    return res.status(500).json({
      status: "error",
      message: "Code execution failed.",
      error: err.message,
    });
  }
};

module.exports = { submitCode, runCode };
