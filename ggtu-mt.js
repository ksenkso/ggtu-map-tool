#!/usr/bin/env node
'use strict';
const rimraf = require('rimraf');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const program = require('commander');

program
    .version('0.0.1')
    .description('GGTU Map Tool')
    .option('-o, --output <path>', 'Output file path')
    .option('--preview', 'Create preview page for the map')
    .option('-m, --meter <length>', 'Provide the length of one meter on this map')
    .arguments('<file>')
    .action((mapPath) => {
        const fullPath = path.resolve(process.cwd(), mapPath);
        if (fullPath && fs.existsSync(fullPath)) {
            fs.readFile(fullPath, (err, data) => {
                if (err) {
                    console.error(err);
                } else {
                    const $ = cheerio.load(data);
                    // Remove `defs element to clean styles
                    cleanupMap($);
                    // compute the output path
                    let outputPath = getOutputPath(fullPath);
                    // transform coordinates (scale position attributes and translations through transform)
                    const $svg = $('svg');
                    const ratio = 1 / program.meter;
                    transformViewBox($svg);
                    transformCoords($, ratio);
                    createPreviewIfNeeded(outputPath, $svg);
                    // Write the transformed map to the output file
                    fs.writeFile(outputPath, $svg.parent().html(), null, (err) => {
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

/**
 * Scales number `n` by factor `f` with 2 decimal digits
 * @param {number} n
 * @param {number} f
 * @returns {number}
 */
function scale(n, f) {
    if (!n) return 0;
    return Math.round(n*f * 100) / 100;
}

/**
 *
 * @param $el
 * @param {number} ratio
 */
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

/**
 *
 * @param {string} fullPath
 * @returns {string}
 */
function getOutputPath(fullPath) {
    if (program.output) {
        return path.resolve(process.cwd(), program.output);
    } else {
        return path.resolve(process.cwd(), path.basename(fullPath, '.svg') + '.transformed.svg');
    }
}

/**
 *
 * @param $svg
 * @param {number} ratio
 */
function transformViewBox($svg, ratio) {
    const oldViewBox = $svg.attr('viewBox').split(' ').map(v => +v);
    // Get the scale ratio
    const newViewBox = oldViewBox.map(v => scale(v, ratio));
    newViewBox[0] -= 0.6;
    newViewBox[1] -= 0.6;
    newViewBox[2] += 1.2;
    newViewBox[3] += 1.2;
    $svg.attr('viewBox', newViewBox.join(' '));
}

/**
 *
 * @param $map
 */
function cleanupMap($map) {
    $map('defs').remove();
    // Move areas to the back
    $map('#area, [data-name="area"]').each((i, area) => {
        $map(area).parent().prepend($map(area));
    });
    // Replace data-name with corresponding data-type
    $map('#area, #place, #transition-view, #walls, #door').each((i, el) => {
        const $el = $map(el);
        $el.attr('data-type', $el.attr('id'));
    });
    $map('[data-name]').each((i, item) => {
        const $item = $map(item);
        $item.attr({
            'data-type': $item.attr('data-name'),
            'data-name': null
        });
    });
}

/**
 * For all rects, lines and polygons/polylines update their positions and translations
 * @param $
 * @param ratio
 */
function transformCoords($, ratio) {
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
}

/**
 *
 * @param outputPath
 * @param $svg
 */
function createPreviewIfNeeded(outputPath, $svg) {
    if (program.preview) {
        // Create a preview page;
        const out = path.dirname(outputPath);
        const dirPath = createPreview($svg, out, path.basename(outputPath, '.svg'));
        if (dirPath) {
            console.log('Превью создано: ' + dirPath);
        } else {
            console.log('Ошибка при создании првеью');
        }
    }
}

/**
 *
 * @param $svg
 * @param output
 * @param name
 * @returns {string|null}
 */
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