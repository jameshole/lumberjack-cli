/**
 * Simple prompts for lumberjack
 * Uses built-in readline module
 */

import * as readline from 'readline';

/**
 * Create a readline interface
 */
function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask a yes/no confirmation question
 */
export async function confirm(question: string, defaultValue: boolean = false): Promise<boolean> {
  const rl = createInterface();
  const hint = defaultValue ? '(Y/n)' : '(y/N)';

  return new Promise((resolve) => {
    rl.question(`${question} ${hint} `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === '') {
        resolve(defaultValue);
      } else {
        resolve(trimmed === 'y' || trimmed === 'yes');
      }
    });
  });
}
