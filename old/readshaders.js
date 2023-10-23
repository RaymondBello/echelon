import fs from 'fs'
import path from 'path'

export default (req, res) => {
    const dirRelativeToPublicFolder = 'shaders'

    const dir = path.resolve('./public', dirRelativeToPublicFolder);

    const filePath = path.join(dir, "vertex_shader.wgsl");

    if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath, 'utf-8');
        res.statusCode = 200
        res.json({ shaderData: fileData });
    } else {
        res.statusCode = 404
        res.json({ error: 'File not found' });
    }
}
