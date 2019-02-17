#!/usr/bin/env node
'use strict';
const rimraf = require('rimraf');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const program = require('commander');

function scale(a, s) {
    return Math.round(a*s * 100) / 100;
}

function createPreview($svg, output, name) {
    try {
        const dirPath = path.join(output, 'preview_' + name);
        if (fs.existsSync(dirPath)) {
            rimraf.sync(dirPath);
        }
        fs.mkdirSync(dirPath);
        const file = fs.readFileSync(path.resolve(__dirname, './preview-template.html'));
        const $preview = cheerio.load(file);
        $preview('body').append($svg);
        fs.copyFileSync(path.resolve(__dirname, './style.css'), path.join(dirPath, 'style.css'));
        fs.writeFileSync(path.join(dirPath, 'preview.html'), $preview.html());
        return dirPath;
    } catch (e) {
        console.error(e);
        return null;
    }

}

function applyTranslate($el, ratio) {
    const transform = $el.attr('transform');
    if (transform) {
        const transforms = transform.split(') ').map(s => s + ')');
        transforms[transforms.length - 1] = transforms[transforms.length - 1].slice(0, transforms[transforms.length - 1].length - 1);
        const newTransforms = transforms.map(trf => {
            const translation = trf.match(/translate\(([-0-9. ]+)\)/);
            if (translation) {
                const [dx, dy] = translation[1].split(' ');
                return `translate(${scale(dx, ratio)} ${scale(dy, ratio)})`;
            } else {
                return trf;
            }
        });
        $el.attr('transform', newTransforms.join(' '));
    }
}

program
    .version('0.0.1')
    .description('GGTU Map Tool')
    .option('-o, --output <path>', 'Output file path')
    .option('--preview', 'Create preview page for the map')
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
                    $('#area, #place, #transition-view, #walls').each((i, el) => {
                        const $el = $(el);
                        $el.attr('data-type', $el.attr('id'));
                    });
                    $('[data-name]').each((i, item) => {
                        const $item = $(item);
                        $item.attr({
                            'data-type': $item.attr('data-name'),
                            'data-name': null
                        });
                    });
                    // compute the output path
                    let outputPath;
                    if (program.output) {
                        outputPath = path.resolve(process.cwd(), program.output);
                    } else {
                        outputPath = path.resolve(process.cwd(), path.basename(fullPath, '.svg') + '.transformed.svg');
                    }
                    // transform coordinates (scale position attributes and translations through transform)
                    const $svg = $('svg');
                    const oldViewBox = $svg.attr('viewBox').split(' ').map(v => +v);
                    const newViewBox = [0, 0, 1000, 1000];
                    $svg.attr('viewBox', newViewBox.join(' '));
                    // Get the scale ratio
                    const ratio = Math.min(newViewBox[2] / oldViewBox[2], newViewBox[3]/ oldViewBox[3]);
                    // For all rects, lines and polygons/polylines update their positions and translations
                    $('rect').each((i, rect) => {
                        const $rect = $(rect);
                        applyTranslate($rect, ratio);
                        $rect.attr({
                            x: scale(+$rect.attr('x'), ratio),
                            y: scale(+$rect.attr('y'), ratio),
                            width: scale(+$rect.attr('width'), ratio),
                            height: scale(+$rect.attr('height'), ratio)
                        });
                    });
                    $('line').each((i, line) => {
                        const $line = $(line);
                        applyTranslate($line, ratio);
                        $line.attr({
                            x1: scale(+$line.attr('x1'), ratio),
                            y1: scale(+$line.attr('y1'), ratio),
                            x2: scale(+$line.attr('x2'), ratio),
                            y2: scale(+$line.attr('y2'), ratio)
                        });
                    });
                    $('polyline, polygon').each((i, poly) => {
                        const $poly = $(poly);
                        applyTranslate($poly, ratio);
                        const oldPoints = $poly.attr('points').split(' ').map(p => +p);
                        const newPoints = oldPoints.map(p => scale(p, ratio)).join(' ');
                        $poly.attr('points', newPoints);
                    });
                    $svg.attr('viewBox', '0 0 1000 1000');
                    if (program.preview) {
                        // Create a preview page;
                        const out = path.dirname(outputPath);
                        const dirPath = createPreview($svg, out, path.basename(outputPath, '.svg'));
                        if (dirPath) {
                            console.log('Превью создано: ' + dirPath);
                        }
                    }
                    // Write the transformed map to the output file
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

