# Maps

This folder holds SVG (vectorial) maps that can be used in Bob.

Each SVG map must follow the requirements:

 * It should be a valid SVG file.

 * The top level node (svg) should have a `width` and a `height` attributes. They will be used to
   create a viewbox with an origin at 0, 0.

 * The top level node (svg) should have a child `title` containing the title of the map (e.g. "Map
   of Canada's provinces").

 * Each local area should be defined by exactly one `path` element and have an `id` attribute. The
   IDs should be the ones used by Bob for the geograhy of the country. Each path may have a `title`
   child containing the human-readable name of the area.

## Troubleshooting

If your original file contains **other path** elements (without an `id` attribute) for decoration,
they will be ignored and not displayed.

If some of your local areas are described by something **other than a path** (e.g. a circle), you
need to turn them into a path.

If some of your local areas are described by **multiple path** elements you need to combine them in
one path only (i.e. a single path can describe several non contiguous geometries in SVG).

If your original file contains `transform` attributes on the path elements or on groups, you need
to apply those transformations to the actual path coordinates as only the path elements are used.
See how to do that on [Stack Overflow](https://stackoverflow.com/questions/13329125/removing-transforms-in-svg-files)
for instance.
