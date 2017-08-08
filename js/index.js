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

const version = '1.1.0'

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

if (argv(0) == '-v') {
  console.log(`anymacro version ${version}`)
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
  var hasValue = afterdef.indexOf(' ') !== -1
  var name = afterdef.substring(0, hasValue ? afterdef.indexOf(' ')
                                            : afterdef.length)
  if (!name) {
    console.error(`Error: No name specified for define, line ${linenum}`)
    console.error(`  ${line}`)
    rc = 2
    rl.close()
    return
  }
  var value = hasValue ? afterdef.substring(afterdef.indexOf(' ') + 1,
                                              afterdef.length) : ''
  return new Define(name, value)
}

function processLine (rawline, inputfile, outputfile, rl, linenum, afterPause) {
  let line = rawline.trim()
  let define, name, isNot
  if (line[0] == '#') {
    let lineIndexOfSpace = line.indexOf(' ')
    let macro = line.substring(1, lineIndexOfSpace !== -1 ? lineIndexOfSpace
                                                          : line.length)
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
  } else if (line.substring(0, 2) == "//") {
    // Simply do nothing. Skip it.
  } else if (skipCount == 0) {
    let resolvedLine = rawline.valueOf()
    defines.forEach((e) => {
      let regex = new RegExp("(\\W|^)" + e.name + "(\\W|$)", "g")
      if (rawline.match(regex)) {
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
    })
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

  let _startLine = startLine | 0;
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
