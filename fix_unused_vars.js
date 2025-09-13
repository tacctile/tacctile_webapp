import fs from "fs";
import path from "path";
import { execSync } from "child_process";

function fixUnusedVars() {
  try {
    const eslintOutput = execSync("npx eslint . --format=json", { 
      encoding: "utf8",
      cwd: process.cwd()
    });
    
    const results = JSON.parse(eslintOutput);
    const fixes = new Map();
    
    for (const result of results) {
      if (result.messages) {
        const filePath = result.filePath;
        const fileContent = fs.readFileSync(filePath, "utf8");
        let updatedContent = fileContent;
        
        // Get unused var messages
        const unusedVars = result.messages.filter(m => 
          m.ruleId === "@typescript-eslint/no-unused-vars"
        );
        
        // Sort by line number descending to avoid position shifts
        unusedVars.sort((a, b) => b.line - a.line);
        
        for (const msg of unusedVars) {
          const lines = updatedContent.split("\n");
          const lineIndex = msg.line - 1;
          
          if (lineIndex >= 0 && lineIndex < lines.length) {
            const line = lines[lineIndex];
            
            // Handle different patterns
            if (msg.message.includes("defined but never used")) {
              // For imports and parameters
              if (line.includes("import") && !line.includes("_")) {
                // Skip import removals for now - too complex
                continue;
              } else if (line.includes("(") && line.includes(":")) {
                // Function parameter - add underscore
                const varName = msg.message.match(/'"(.+)"'/)?.[1];
                if (varName && !varName.startsWith("_")) {
                  lines[lineIndex] = line.replace(
                    new RegExp(`\b${varName}\b`), 
                    `_${varName}`
                  );
                }
              }
            } else if (msg.message.includes("assigned a value but never used")) {
              // For variables - add underscore
              const varName = msg.message.match(/'"(.+)"'/)?.[1];
              if (varName && !varName.startsWith("_")) {
                lines[lineIndex] = line.replace(
                  new RegExp(`\b${varName}\b`), 
                  `_${varName}`
                );
              }
            }
          }
        }
        
        const newContent = lines.join("\n");
        if (newContent !== fileContent) {
          fs.writeFileSync(filePath, newContent);
          console.log(`Fixed unused vars in: ${path.basename(filePath)}`);
        }
      }
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

fixUnusedVars();
