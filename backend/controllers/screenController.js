import { listScreens } from '../repositories/screenRepository.js';

export const getScreens = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const screens = await listScreens({ includeInactive });

    res.json({
      status: 'success',
      data: {
        screens,
      },
    });
  } catch (error) {
    console.error('Error fetching screens:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to load screen definitions',
    });
  }
};

