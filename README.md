# NOTE

This repo is no longer maintained

# ggtu-map-tool

GGTU Map Tool

## Description

This is a CLI tool to mark up objects on an SVG map.

Related repos:
- [Admin panel repo](https://github.com/ksenkso/ggtu-maps-admin)
- [Map library (API client and renderer)](https://github.com/ksenkso/ggtu-map)
- [Map client](https://github.com/ksenkso/ggtu-map-client)
- [Map parsing tool](https://github.com/ksenkso/ggtu-map-tool)

## Usage

This tool is made with [commander](https://www.npmjs.com/package/commander).
To see docs run:

```bash
ggtu-mt --help
```

You should pass a path to a source SVG map and it will mark it up, fix dimensions according to the `meter` setting and save it to the `output-path`.

You can get a preview path with the `--preview` flag.

## SVG Map

To define an object on the map, you have to wrap them in `g` elements with `data-name` values from the list:
- 'area'
- 'place'
- 'transition-view'
- 'walls'
- 'door'
- 'building'

Honestly, I should've document this 3 years ago. Really.
