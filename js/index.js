/*
 *  AnyMacro Preprocessor
 *  Copyright (C) 2017  Simao Gomes Viana
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const readline = require('readline')
const fs = require('fs')
const path = require('path')

const version = '1.4.0'

var rc = 0

function argv (ix) {
  return process.argv[2 + ix]
} 

function argc () {
  return process.argv.length - 2
}

function havearg (arg) {
  var i = 0
  var result = false
  process.argv.forEach((e) => {
    if (i < 2) {
      i++
    } else {
      if (e == arg) {
        result = true
        return
      }
    }
  })
  return result
}

var debug = havearg('-d') || havearg('--debug')

if (debug) console.log("Debug is enabled")

if (argv(0) == '-v' || argv(0) == "--version") {
  console.log(`AnyMacro Preprocessor version ${version}`)
  process.exit(0)
}

if (argc() < 2) {
  console.log(`Usage: ${process.argv0} <input file> <output file>`)
  process.exit(1)
}

function fileExists (filename) {
  try {
    fs.statSync(filename)
    return true
  } catch (ex) {
    if (ex.code == 'ENOENT') {
      return false
    }
  }
}

var mInputfile = argv(0)
var mOutputfile = path.resolve(argv(1))

function Define (name, value) {
  this.name = name
  this.value = value || ''
}

function FuncDefine (name, args, func) {
  this.name = name
  this.args = args
  this.func = func
}

var defines = []
var expectEndifCount = 0
var skipCount = 0

function defineExists (name) {
  var result = false
  defines.forEach((e) => {
    if (e.name == name) {
      result = true
      return
    }
  })
  return result
}

function removeDefine (name) {
  defines.forEach((e) => {
    if (e.name == name) {
      if (debug) {
        console.log(`Splicing ${e.name} out of defines ` +
                    `on index ${defines.indexOf(e)}`)
      }
      defines.splice(defines.indexOf(e), 1)
      return
    }
  })
}

function getDefine (name) {
  var result = null
  defines.forEach((e) => {
    if (e.name == name) {
      result = e
      return
    }
  })
  return result
}

function createDefineFromLine (line, rl, linenum) {
  var afterdef = line.substring(line.indexOf(' ') + 1, line.length)
  if (debug) {
    console.log(` afterdef: ${afterdef}`)
  }
  let spaceIx = afterdef.indexOf(' ')
  let brIx = afterdef.indexOf('(')
  let clBrIx = afterdef.indexOf(')')
  let isFunc = false
  if (brIx !== -1 && brIx < spaceIx) {
    isFunc = true
    if (clBrIx === -1) {
      console.error(`Error: Unterminated function definition on line ${linenum}`)
      console.error(`       Missing ')'.`)
      console.error(`  ${line}`)
      rc = 2
      rl.close()
      return
    }
    if (afterdef.charAt(clBrIx + 1) == ' ') {
      spaceIx = clBrIx + 1
    } else {
      spaceIx = -1
    }
  }
  var hasValue = spaceIx !== -1
  var name = afterdef.substring(0, hasValue ? spaceIx : afterdef.length)
  if (!name) {
    console.error(`Error: No name specified for define, line ${linenum}`)
    console.error(`  ${line}`)
    rc = 2
    rl.close()
    return
  }
  var value = hasValue ? afterdef.substring(spaceIx + 1, afterdef.length)
                       : ''
  let args, func, funcName
  if (isFunc) {
    funcName = name.substring(0, name.indexOf('(')).trim()
    args = []
    let argsStr = name.substring(name.indexOf('(') + 1, name.indexOf(')'))
    argsStr.split(',').forEach((s) => {
      let str = s.trim()
      args.push(str)
    })
    func = value
  }
  return isFunc ? new FuncDefine(funcName, args, func) : new Define(name, value)
}

function resolveLine (lineToResolve, linenum) {
  let resolvedLine = lineToResolve
  defines.forEach((e) => {
    if (e.value !== undefined) {
      let regex = new RegExp("(\\W|^)" + e.name + "(\\W|$)", "g")
      if (resolvedLine.match(regex)) {
        if (debug) {
          console.log(` Current line has define ${e.name}`)
        }
        let matches = regex.exec(resolvedLine)
        let newmatches = []
        let i = 0
        matches.forEach((match) => {
          if (match.length >= e.name.length) {
            if (debug) {
              console.log(`   Match ${match}`)
            }
            newmatches.push([match.replace(e.name, e.value), i])
          }
          i++
        })
        i = 0
        newmatches.forEach((match) => {
          resolvedLine =
            resolvedLine.replace(matches[newmatches[i][1]], newmatches[i][0])
          i++
        })
      }
    } else if (e.func !== undefined) {
      // Example: \b[()\[\]{},; ]*prnt( *)[(][^,]*[)]
      let regexStr = "\\b[()\\[\\]{},; ]*?"
      let replRegexStr = e.name + "( *?)[(]"
      var i
      for (i = 0; i < e.args.length; i++) {
        replRegexStr += "[^,]+?,"
      }
      replRegexStr = replRegexStr.substring(0, replRegexStr.length - 1)
      replRegexStr += "[)]"
      regexStr += replRegexStr
      let finalReplRegex = new RegExp(replRegexStr)
      if (debug) {
        console.log(`   regexStr: ${regexStr}`)
      }
      let regex = new RegExp(regexStr)
      while (resolvedLine.match(regex)) {
        if (debug) {
          console.log(`  ${linenum} uses a function define!`)
        }
        let funcBody = e.func.valueOf()
        if (debug) {
          console.log(`   Defined function body: ${funcBody}`)
        }
        let matches = regex.exec(resolvedLine)
        if (debug) {
          console.log(`   All matches: \n${JSON.stringify(matches)}`)
        }
        let match = matches[0]
        if (match === undefined || match === null ||
              match.trim().length === 0) return
        if (debug) {
          console.log(`   Processing match ${match}`)
        }
        let lineArgsStr = match.substring(
                            match.indexOf('(') + 1, match.lastIndexOf(')'))
        let lineArgs = []
        if (lineArgsStr.indexOf(',') !== -1) {
          lineArgsStr.split(',').forEach((lineArg) => {
            lineArgs.push(lineArg.trim())
          })
        } else {
          lineArgs.push(lineArgsStr.trim())
        }
        if (debug) {
          console.log(`   Line args: ${lineArgs}`)
        }
        i = 0
        e.args.forEach((arg) => {
          if (debug) {
            console.log(`    Function body before replace: ${funcBody}`)
          }
          let replRegex = new RegExp("\\b" + arg + "\\b", "g")
          if (debug) {
            let replRegexMatches = replRegex.exec(funcBody)
            console.log(`    Repl regex matches: ` +
                          `${JSON.stringify(replRegexMatches)}`)
          }
          funcBody = funcBody.replace(replRegex, lineArgs[i])
          if (debug) {
            console.log(`    Replaced ${arg} with ${lineArgs[i]}`)
            console.log(`    New function body: ${funcBody}\n`)
          }
          i++
        })
        resolvedLine = resolvedLine.replace(finalReplRegex, funcBody)
      }
    }
  })
  return resolvedLine
}

function processLine (rawline, inputfile, outputfile, rl, linenum, afterPause) {
  let line = rawline.trim()
  let define, name, isNot
  let printLine = true
  if (line.substring(0, 2) == "//") {
    return
  }
  if ((() => { if (line[0] == '#') {
    let lineIndexOfSpace = line.indexOf(' ')
    let macro = line.substring(1, lineIndexOfSpace !== -1 ? lineIndexOfSpace
                                                          : line.length)
    if (macro == 'include') {
      return
    }
    printLine = false
    if (macro == 'endif') {
      if (skipCount > 0) skipCount--
      expectEndifCount--
      return
    }
    if (macro == 'else') {
      if (skipCount > 0) skipCount--
      else skipCount++
      return
    }
    if (skipCount > 0) {
      return
    }
    switch (macro) {
      case 'define':
        define = createDefineFromLine(line, rl, linenum)
        if (defineExists(define.name)) {
          console.error(`Error: Define ${define.name} already exists, line ${linenum}`)
          rc = 2
          rl.close()
          break
        }
        defines.push(define)
        if (debug) {
          console.log(` Added define ${JSON.stringify(define)}`)
        }
        break
      case 'undef':
        define = createDefineFromLine(line, rl, linenum)
        if (!defineExists(define.name)) {
          console.error(`Error: Define ${define.name} does not exist, line ${linenum}`)
          console.error(`  ${rawline}`)
          rc = 2
          rl.close()
          break
        }
        removeDefine(define.name)
        if (debug) {
          console.log(` Removed define "${define.name}"`)
        }
        break
      case 'ifndef':
        isNot = true
      case 'ifdef':
        name = line.substring(line.indexOf(' ') + 1, line.length)
        expectEndifCount++
        if (defineExists(name)) {
          if (isNot) skipCount++
          if (debug) {
            console.log(` Define ${name} exists`)
          }
        } else {
          if (!isNot) skipCount++
          if (debug) {
            console.log(` Define ${name} does not exist`)
          }
        }
        break
      case 'if':
        expectEndifCount++
        let notEquals = line.match(/[!]=/g) != null
        if (debug && notEquals) {
          console.log('  This is a not-equals if')
        }
        name = line.substring(line.indexOf(' ') + 1,
                                    line.indexOf((notEquals ? '!' : '=') + '='))
        name = name.trim()
        let expectedValue = line.substring(
          line.indexOf((notEquals ? '!' : '=') + '=') + 3, line.length)
        define = getDefine(name)
        if (define === null) {
          console.error(`Error: Define ${name} does not exist, line ${linenum}`)
          console.error(`  ${rawline}`)
          rc = 2
          rl.close()
          break
        }
        if (notEquals ? expectedValue != define.value
                      : expectedValue == define.value) {
          if (debug) {
            console.log(` Define ${name} has expected value`)
          }
        } else {
          skipCount++
          if (debug) {
            console.log(` Define ${name} does not have expected value`)
          }
        }
        break
      case 'import':
        let filename = line.substring(line.lastIndexOf(' ') + 1, line.length)
        if (afterPause !== null) {
          rl.pause()
        }
        processLineByLine(`${path.dirname(inputfile)}/${filename}`, outputfile, 1, false, () => {
          if (afterPause !== null) {
            afterPause()
            rl.resume()
          }
        })
        return true
      default:
        console.error(`Error: Unknown macro "${macro}" in line ${linenum}:`)
        console.error(`  ${rawline}`)
        rc = 2
        rl.close()
        break
    }
  }})() === true) return true
  if (skipCount == 0 && printLine) {
    let resolvedLine = resolveLine(rawline.valueOf())
    let prevResolvedLine
    while (resolvedLine !== prevResolvedLine) {
      prevResolvedLine = resolvedLine.valueOf()
      resolvedLine = resolveLine(prevResolvedLine)
    }
    fs.appendFileSync(outputfile, `${resolvedLine}\n`)
  }
}

function processLineByLine (inputfile, outputfile, _startLine, firstIteration,
                            onClose) {
  // Contains leaked lines in case of pause()
  let tmpbuf = []
  let paused = false 

  let rl = readline.createInterface({
    input: fs.createReadStream(inputfile)
  })

  let linenum = 0

  rl.on('line', (rawline) => {
    linenum++
    if (linenum < _startLine) return
    if (paused) {
      tmpbuf.push([linenum, rawline])
      return
    }
    paused = (processLine(rawline, inputfile, outputfile, rl, linenum, () => {
      tmpbuf.forEach((l) => {
        processLine(l[1], inputfile, outputfile, rl, l[0], null)
      })
      // Clear
      tmpbuf.length = 0
      paused = false
    }) === true)
  })

  rl.on('close', () => {
    if (rc == 0) {
      if (expectEndifCount != 0) {
        console.log(`Warning: ${expectEndifCount} endifs missing!`)
      }
    }
    if (firstIteration === true || rc != 0) process.exit(rc)
    if (onClose !== undefined && onClose !== null) onClose()
  })
}

function doWork (inputfile, outputfile, firstIteration, startLine) {

  let _startLine = startLine | 0
  !(_startLine > 0) && (_startLine = 1)

  if (!fileExists(inputfile)) {
    console.error(`Error: File ${inputfile} does not exist`)
    process.exit(1)
  }

  if (firstIteration && fileExists(outputfile)) {
    fs.unlinkSync(outputfile)
  }
  
  processLineByLine(inputfile, outputfile, _startLine, firstIteration)
}

doWork(mInputfile, mOutputfile, true)
