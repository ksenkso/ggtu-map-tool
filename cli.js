#!/usr/bin/env node
'use strict';
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const program = require('commander');

function getLength(meterLine) {
    const x1 = parseFloat(meterLine.attr('x1'));
    const x2 = parseFloat(meterLine.attr('x2'));
    const y1 = parseFloat(meterLine.attr('y1'));
    const y2 = parseFloat(meterLine.attr('y2'));
    return Math.hypot(x2-x1, y2-y1);
}

program
    .version('0.0.1')
    .option('-o, --output <path>', 'Output file path')
    .arguments('<file>')
    .action((mapPath) => {
        const fullPath = path.resolve(process.cwd(), mapPath);
        if (fullPath && fs.existsSync(fullPath)) {
            fs.readFile(fullPath, (err, data) => {
                if (err) {
                    console.error(err);
                } else {
                    const $ = cheerio.load(data);
                    // Move areas to the back
                    $('#area, [data-name="area"]').each((i, area) => {
                        $(area).parent().prepend($(area));
                    });
                    // Replace data-name with corresponding data-type
                    $('#area').attr({
                        'data-type': 'area',
                        'data-name': null
                    });
                    $('#place').attr({
                        'data-type': 'place',
                        'data-name': null
                    });
                    $('#stairs').attr({
                        'data-type': 'transition-view',
                        'data-name': null
                    });
                    $('#exit').attr({
                        'data-type': 'transition-view',
                        'data-name': null
                    });
                    $('#walls').attr({
                        'data-type': 'walls',
                        'data-name': null
                    });
                    $('[data-name]').each((i, item) => {
                        const $item = $(item);
                        $item.attr({
                            'data-type': $item.attr('data-name'),
                            'data-name': null
                        });
                    });
                    // Write the output to the same file
                    let outputPath;
                    if (program.output) {
                        outputPath = path.resolve(process.cwd(), program.output);
                    } else {
                        outputPath = path.resolve(process.cwd(), path.basename(fullPath, '.svg') + '.transformed.svg');
                    }
                    // TODO: Transform viewBox and coordinates to match GGTU Map Requirements

                    const meterLine = $('#meter');
                    const oldMeter = getLength(meterLine);
                    const newMeter = 1/oldMeter;
                    $('rect').each((i, rect) => {
                        const $rect = $(rect);
                        $rect.attr({
                            x: +$rect.attr('x') * newMeter,
                            y: +$rect.attr('y') * newMeter,
                            width: +$rect.attr('width') * newMeter,
                            height: +$rect.attr('height') * newMeter
                        });
                    });
                    $('line').each((i, line) => {
                        const $line = $(line);
                        $line.attr({
                            x1: +$line.attr('x1') * newMeter,
                            y1: +$line.attr('y1') * newMeter,
                            x2: +$line.attr('x2') * newMeter,
                            y2: +$line.attr('y2') * newMeter
                        });
                    });
                    $('polyline, polygon').each((i, poly) => {
                        const $poly = $(poly);
                        const oldPoints = $poly.attr('points').split(' ').map(p => +p);
                        const newPoints = oldPoints.map(p => p * newMeter).join(' ');
                        $poly.attr('points', newPoints);
                    });
                    $('svg').attr('viewBox', '0 0 1000 1000');

                    fs.writeFile(outputPath, $('body').html(), null, (err) => {
                        if (!err) {
                            console.log('Готово!');
                        } else {
                            console.error(err);
                        }
                    })
                }
            })
        } else {
            console.log('Указанный файл не найден');
        }
    })
    .parse(process.argv);

