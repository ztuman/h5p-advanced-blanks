﻿import { ClozeElement, ClozeElementType } from './cloze-element';
import { Answer } from './answer';
import { Message } from './message';
import { Highlight } from './highlight';
import { Evaluation, MessageType, ClozeType } from './enums';
import { H5PLocalization, LocalizationLabels } from '../services/localization';
import { ISettings } from "../services/settings";
import { getLongestString, shuffleArray } from "../../lib/helpers";

export class Blank extends ClozeElement {
  // content
  correctAnswers: Answer[];
  incorrectAnswers: Answer[];
  hint: Message;
  id: string;
  choices: string[];
  hasHint: boolean;

  // viewmodel stuff
  enteredText: string;
  isCorrect: boolean;
  isError: boolean;
  isRetry: boolean;
  isShowingSolution: boolean;
  message: string;
  showMessage: boolean;
  minTextLength: number;

  /**
   * Add incorrect answers after initializing the object. Call finishInitialization()
   * when done.
   * @param  {ISettings} settings
   * @param  {string} id
   * @param  {string} correctText?
   * @param  {string} hintText?
   */
  constructor(private settings: ISettings, private localization: H5PLocalization, id: string) {
    super();

    this.enteredText = "";
    this.correctAnswers = new Array();
    this.incorrectAnswers = new Array();
    this.choices = new Array();
    this.showMessage = false;
    this.type = ClozeElementType.Blank;

    this.id = id;
  }

  /**
  * Call this method when all incorrect answers have been added.
  */
  public finishInitialization(): void {
    if (this.settings.clozeType === ClozeType.Select) {
      this.loadChoices();
    }
    this.calculateMinTextLength();
  }

  public addCorrectAnswer(answer: Answer) {
    this.correctAnswers.push(answer);
  }

  public setHint(message: Message) {
    this.hint = message;
    this.hasHint = this.hint.text != "";
  }

  /**
   * Adds the incorrect answer to the list.
   * @param text - What the user must enter.
   * @param reaction  - What the user gets displayed when he enteres the text.
   */
  public addIncorrectAnswer(text: string, reaction: string): void {
    this.incorrectAnswers.push(
      new Answer(text, reaction, this.settings));
  }

  /**
   * Returns how many characters the input box must have be to allow for all correct answers.
   */
  // TODO: refactor
  private calculateMinTextLength(): void {
    var answers: string[] = new Array();
    for (var correctAnswer of this.correctAnswers) {
      answers.push(getLongestString(correctAnswer.alternatives));
    }
    var longestAnswer = getLongestString(answers);
    var l = longestAnswer.length;
    this.minTextLength = Math.max(10, l - (l % 10) + 10);
  }

  /**
   * Creates a list of choices from all alternatives provided by
   * the correct and incorrect answers.
   */
  private loadChoices(): string[] {
    this.choices = new Array();
    for (var answer of this.correctAnswers) {
      for (var alternative of answer.alternatives) {
        this.choices.push(alternative);
      }
    }

    for (var answer of this.incorrectAnswers) {
      for (var alternative of answer.alternatives) {
        this.choices.push(alternative);
      }
    }

    this.choices = shuffleArray(this.choices);
    this.choices.unshift("");

    return this.choices;
  }

  /**
  * Clears the blank from all entered content and hides popups.
  */
  public reset() {
    this.enteredText = "";
    this.removeTooltip();
    this.setAnswerState(MessageType.None);
  }

  public showSolution() {
    this.evaluateEnteredAnswer();
    this.removeTooltip();
    if (this.isCorrect)
      return;
    this.enteredText = this.correctAnswers[0].alternatives[0];
    this.setAnswerState(MessageType.ShowSolution);
  }

  private displayTooltip(message: string, type: MessageType) {
    this.showMessage = true;
    this.message = message;
  }

  public removeTooltip() {
    this.showMessage = false;
  }

  private setTooltipErrorText(text: string) {
    this.displayTooltip(text, MessageType.Error);
  }

  /**
   * Checks if the entered text is the correct answer or one of the 
   * incorrect ones and gives the user feedback accordingly.
   */
  public evaluateEnteredAnswer() {
    this.removeTooltip();

    var exactCorrectMatches = this.correctAnswers.filter(answer => answer.evaluateEnteredText(this.enteredText) === Evaluation.ExactMatch);
    var closeCorrectMatches = this.correctAnswers.filter(answer => answer.evaluateEnteredText(this.enteredText) === Evaluation.CloseMatch);
    var exactIncorrectMatches = this.incorrectAnswers.filter(answer => answer.evaluateEnteredText(this.enteredText) === Evaluation.ExactMatch);
    var closeIncorrectMatches = this.incorrectAnswers.filter(answer => answer.evaluateEnteredText(this.enteredText) === Evaluation.CloseMatch);

    if (exactCorrectMatches.length > 0) {
      this.setAnswerState(MessageType.Correct);
      return;
    }

    if (exactIncorrectMatches.length > 0) {
      this.setAnswerState(MessageType.Error);
      this.showErrorTooltip(exactIncorrectMatches[0]);
      return;
    }

    if (closeCorrectMatches.length > 0) {
      if (this.settings.warnSpellingErrors) {
        this.displayTooltip(this.localization.getTextFromLabel(LocalizationLabels.typoMessage), MessageType.Retry);
        this.setAnswerState(MessageType.Retry);
        return;
      }
      if (this.settings.acceptSpellingErrors) {
        this.setAnswerState(MessageType.Correct);
        this.enteredText = closeCorrectMatches[0].alternatives[0];
        return;
        // TODO: use closest match
      }
    }

    if (closeIncorrectMatches.length > 0) {
      this.setAnswerState(MessageType.Error);
      this.showErrorTooltip(closeIncorrectMatches[0]);
      return;
    }

    var alwaysApplyingAnswers = this.incorrectAnswers.filter(a => a.appliesAlways);
    if (alwaysApplyingAnswers && alwaysApplyingAnswers.length > 0) {
      this.showErrorTooltip(alwaysApplyingAnswers[0]);
    }

    this.setAnswerState(MessageType.Error);
  }

  /**
   * Sets the boolean properties isCorrect, is Error and isRetry according to thepassed  messageType.
   * @param messageType 
   */
  private setAnswerState(messageType: MessageType) {
    this.isCorrect = false;
    this.isError = false;
    this.isRetry = false;
    this.isShowingSolution = false;

    switch (messageType) {
      case MessageType.Correct:
        this.isCorrect = true;
        break;
      case MessageType.Error:
        this.isError = true;
        break;
      case MessageType.Retry:
        this.isRetry = true;
        break;
      case MessageType.ShowSolution:
        this.isShowingSolution = true;
        break;
    }
  }

  private showErrorTooltip(answer: Answer) {
    if (answer.message && answer.message.text) {
      this.setTooltipErrorText(answer.message.text);
    }
    answer.activateHighlights();
  }

  /**
   * Displays the hint in the tooltip.
   */
  public showHint() {
    if (this.isShowingSolution || this.isCorrect)
      return;

    this.removeTooltip();
    if (this.hint && this.hint.text != "") {
      this.displayTooltip(this.hint.text, MessageType.Retry);
      if (this.hint.highlightedElements)
        this.hint.highlightedElements.forEach((highlight) => highlight.isHighlighted = true);
      this.isRetry = true;
    }
  }
}