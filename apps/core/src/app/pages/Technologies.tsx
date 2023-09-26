import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Search, SearchIconWrapper, StyledInputBase, breadCrumbsConstants } from '@octacore-frontend/constant';
import { BreadCrumbs } from '@octacore-frontend/shared-ui';
import React from 'react'
import SearchIcon from '@mui/icons-material/Search';
import { styled } from '@mui/material/styles';
import TechnologiesTable from '../components/TechnologiesTable';

const TableHeadingBox = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: '0 0 0.5rem 0',
    padding: '0px 0.3rem',
    [theme.breakpoints.down('sm')]: {
        flexDirection: 'column',
        alignItems: 'start',
        justifyContent: 'center',
    },
}));

function Technologies() {
    const currentPage = breadCrumbsConstants.core.technologies;
    const currentProject = breadCrumbsConstants.core.name;
    const { palette } = useTheme()
    return (
        <>
            <BreadCrumbs currentProject={currentProject} currentPage={currentPage} />
            <TableHeadingBox>
                <Typography variant="subtitle2" sx={{ textTransform: 'uppercase' }}>
                    Technologies
                </Typography>
                <Search>
                    <SearchIconWrapper>
                        <SearchIcon sx={{ color: palette.text.secondary }} />
                    </SearchIconWrapper>
                    <StyledInputBase
                        placeholder="Search…"
                        inputProps={{ 'aria-label': 'search' }}
                    />
                </Search>
            </TableHeadingBox>
            <TechnologiesTable />
        </>
    )
}

export default Technologies
