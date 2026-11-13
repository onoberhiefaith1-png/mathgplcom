import { describe, expect, it } from "vitest";
import {
  answeredQuestionNotice,
  isOpaqueId,
  notificationBody,
  notificationContextSentence,
  notificationTitle,
  plainNotificationText,
} from "../plainText";

describe("plain notification text", () => {
  it("keeps an ordinary question as a sentence", () => {
    expect(
      plainNotificationText(
        "I don't understand why we divide both sides by 3.",
      ),
    ).toBe("I don't understand why we divide both sides by 3.");
  });

  it("drops html and markdown so the sentence is what was meant", () => {
    expect(
      plainNotificationText(
        '<p>Please see <strong>question 2</strong> in the <a href="https://example.com">notes</a>.</p>',
      ),
    ).toBe("Please see question 2 in the notes.");
    expect(
      plainNotificationText(
        "**Remember:** finish [the task](https://example.com/task).",
      ),
    ).toBe("Remember: finish the task.");
  });

  it("unwraps maths into readable symbols", () => {
    expect(
      plainNotificationText(
        "Why is $x^2 + 3 = 0$ solved by \\(\\frac{1}{2}\\)?",
      ),
    ).toBe("Why is x^2 + 3 = 0 solved by 1/2?");
  });

  it("reads a json payload as its message", () => {
    expect(
      plainNotificationText(
        '{"id":"bq-1","body":"Can you explain the middle step?"}',
      ),
    ).toBe("Can you explain the middle step?");
  });

  it("removes a pasted record id from a sentence", () => {
    expect(
      plainNotificationText(
        "Your question 7c9e6679-7425-40de-944b-e07fc1f90ae7 was answered.",
      ),
    ).toBe("Your question was answered.");
  });

  it("treats ids as unreadable and titles as readable", () => {
    expect(isOpaqueId("7c9e6679-7425-40de-944b-e07fc1f90ae7")).toBe(true);
    expect(isOpaqueId("bq-1")).toBe(true);
    expect(isOpaqueId("board_question")).toBe(true);
    expect(isOpaqueId("Fractions of a whole")).toBe(false);
    expect(isOpaqueId("Algebra")).toBe(false);
  });

  it("titles and bodies fall back to a sentence", () => {
    expect(notificationTitle("  ", "Ada")).toBe("Ada");
    expect(notificationTitle("bq-1", null)).toBe("Notification");
    expect(notificationBody("   ")).toBe("This notification has no message.");
    expect(notificationBody("<p>I am stuck on step 2.</p>")).toBe(
      "I am stuck on step 2.",
    );
  });

  it("describes context without the question id", () => {
    expect(
      notificationContextSentence({
        className: "Year 9",
        assignmentTitle: "Fractions",
        boardQuestionId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        source: "assessment",
      }),
    ).toBe("About the assignment “Fractions” in the class “Year 9”.");
    expect(
      notificationContextSentence({
        boardQuestionId: "bq-1",
        source: "smartboard",
      }),
    ).toBe("This came from the Smartboard.");
    expect(
      notificationContextSentence({
        source: "question_submission",
        boardQuestionId: "abc_def",
      }),
    ).toBeNull();
  });

  it("writes an answered question as two sentences", () => {
    expect(
      answeredQuestionNotice(
        "<p>Why divide by $3$?</p>",
        "Dividing both sides keeps the equation balanced.",
      ),
    ).toBe(
      "Your teacher answered your question. You asked, “Why divide by 3?” They replied, “Dividing both sides keeps the equation balanced.”",
    );
  });
});
